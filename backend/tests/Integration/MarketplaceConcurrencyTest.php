<?php

namespace Tests\Integration;

use App\Http\Controllers\MarketplaceController;
use App\Models\Artwork;
use App\Models\ArtworkSale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class MarketplaceConcurrencyTest extends TestCase
{
    public function test_two_real_mysql_connections_cannot_buy_the_same_artwork(): void
    {
        if (getenv('ARTSPACE_CONCURRENCY_TEST') !== '1') {
            $this->markTestSkipped('Opt-in: requires a separate MySQL *_marketplace_test database.');
        }
        $this->assertSame('mysql', config('database.default'));
        $this->assertStringEndsWith('_marketplace_test', config('database.connections.mysql.database'));
        $this->assertStringEndsWith('_marketplace_test', DB::connection()->getDatabaseName());
        $this->artisan('migrate:fresh', ['--force' => true])->assertSuccessful();
        $seller = User::factory()->create(['role' => 'student']);
        $buyers = [User::factory()->create(), User::factory()->create()];
        $artwork = Artwork::create(['user_id' => $seller->id, 'title' => 'Unique',
            'description' => 'Only one', 'category' => 'Painting', 'price_minor' => 12345,
            'image_url' => 'https://example.test/art.png']);
        $gate = storage_path('framework/testing/checkout-'.Str::uuid());
        if (! is_dir(dirname($gate))) {
            mkdir(dirname($gate), 0777, true);
        }
        $processes = [];
        try {
            foreach ($buyers as $i => $buyer) {
                $process = new Process([PHP_BINARY, base_path('tests/Support/checkout-worker.php'),
                    $artwork->id, (string) $buyer->id, $gate, (string) $i], base_path(), null, null, 30);
                $process->start();
                $processes[] = $process;
            }
            $deadline = microtime(true) + 15;
            while (! file_exists($gate.'.0.ready') || ! file_exists($gate.'.1.ready')) {
                if (microtime(true) > $deadline) {
                    $this->fail('Checkout workers did not reach the start barrier.');
                }
                usleep(10000);
            }
            file_put_contents($gate.'.go', 'go');
            $statuses = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
                $statuses[] = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR)['status'];
            }
            sort($statuses);
            $this->assertSame([200, 409], $statuses);
            $this->assertSame(1, ArtworkSale::where('artwork_id', $artwork->id)->count());
            $this->assertSame(12345, ArtworkSale::where('artwork_id', $artwork->id)->firstOrFail()->price_minor);
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop();
                }
            }
            foreach (glob($gate.'.*') ?: [] as $file) {
                unlink($file);
            }
        }
    }

    public function test_sales_and_receipt_are_committed_together_in_real_database_sessions(): void
    {
        if (getenv('ARTSPACE_CONCURRENCY_TEST') !== '1') {
            $this->markTestSkipped('Requires isolated MySQL test database.');
        }
        $this->assertSame('mysql', config('database.default'));
        $this->assertStringEndsWith('_marketplace_test', DB::connection()->getDatabaseName());
        $this->artisan('migrate:fresh', ['--force' => true])->assertSuccessful();
        config(['session.driver' => 'database']);
        $seller = User::factory()->create(['role' => 'student']);
        $buyer = User::factory()->create();
        $artwork = Artwork::create(['user_id' => $seller->id, 'title' => 'Atomic original',
            'description' => 'One', 'category' => 'Print', 'price_minor' => 390, 'image_url' => 'https://example.test/a.png']);
        $session = new Store('test',
            new DatabaseSessionHandler(DB::connection(), 'sessions', 120, app()));
        $session->start();
        $session->put('marketplace.cart.v1', [$artwork->id]);
        $session->save();
        $key = Str::uuid()->toString();
        $request = Request::create('/api/cart/checkout', 'POST', ['requestId' => $key]);
        $request->setLaravelSession($session);
        $request->setUserResolver(fn () => $buyer);
        $controller = app(MarketplaceController::class);
        $receipt = $controller->checkout($request);
        // No middleware save is invoked: a new store/connection must see the receipt already.
        $fresh = new Store('test',
            new DatabaseSessionHandler(DB::connection(), 'sessions', 120, app()));
        $fresh->setId($session->getId());
        $fresh->start();
        $this->assertSame([], $fresh->get('marketplace.cart.v1'));
        $this->assertSame($receipt['saleIds'], $fresh->get('marketplace.receipts.v1')[$buyer->id.':'.$key]['saleIds']);
        $request->setLaravelSession($fresh);
        $this->assertSame($receipt, $controller->checkout($request));
        $this->assertSame(1, ArtworkSale::count());

        // Real database writes followed by an exception must roll back BOTH tables.
        $second = Artwork::create(['user_id' => $seller->id, 'title' => 'Rollback',
            'description' => 'One', 'category' => 'Print', 'price_minor' => 100, 'image_url' => 'https://example.test/b.png']);
        $fresh->put('marketplace.cart.v1', [$second->id]);
        $fresh->save();
        $before = DB::table('sessions')->where('id', $fresh->getId())->value('payload');
        $failing = new class('test', new DatabaseSessionHandler(DB::connection(), 'sessions', 120, app())) extends Store
        {
            public function save()
            {
                parent::save();
                throw new \RuntimeException('Failure after session SQL');
            }
        };
        $failing->setId($fresh->getId());
        $failing->start();
        $request->setLaravelSession($failing);
        $request->merge(['requestId' => Str::uuid()->toString()]);
        try {
            $controller->checkout($request);
            $this->fail('Expected rollback.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Failure after session SQL', $error->getMessage());
        }
        $this->assertSame(1, ArtworkSale::count());
        $this->assertSame($before, DB::table('sessions')->where('id', $fresh->getId())->value('payload'));
        $this->assertSame([$second->id], $failing->get('marketplace.cart.v1'));
    }

    public function test_web_middleware_serializes_parallel_session_readers_and_writers(): void
    {
        if (getenv('ARTSPACE_CONCURRENCY_TEST') !== '1') {
            $this->markTestSkipped('Requires isolated MySQL test database.');
        }
        $this->assertSame('mysql', config('database.default'));
        $this->assertStringEndsWith('_marketplace_test', DB::connection()->getDatabaseName());
        $this->artisan('migrate:fresh', ['--force' => true])->assertSuccessful();
        $session = new Store(config('session.cookie'),
            new DatabaseSessionHandler(DB::connection(), 'sessions', 120, app()));
        $session->start();
        $session->put('marketplace.cart.v1', ['initial']);
        $session->save();
        $gate = storage_path('framework/testing/session-'.Str::uuid());
        if (! is_dir(dirname($gate))) {
            mkdir(dirname($gate), 0777, true);
        }
        $processes = [];
        $awaitFile = function (string $file): void {
            $deadline = microtime(true) + 10;
            while (! file_exists($file)) {
                if (microtime(true) > $deadline) {
                    $this->fail('Session worker did not reach barrier.');
                }
                usleep(10000);
            }
        };
        try {
            foreach ([0, 1] as $i) {
                $process = new Process([PHP_BINARY, base_path('tests/Support/checkout-worker.php'),
                    'session-probe', $session->getId(), $gate, (string) $i], base_path(), null, null, 30);
                $process->start();
                $processes[] = $process;
                $awaitFile($gate.'.'.$i.'.started');
                if ($i === 0) {
                    $awaitFile($gate.'.0.loaded');
                }
            }
            // The second PHP kernel has started but cannot load stale session data.
            usleep(300000);
            $this->assertFileDoesNotExist($gate.'.1.loaded');
            file_put_contents($gate.'.release', 'release');
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
                $result = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
                $this->assertSame(200, $result['status']);
                $this->assertSame(['updated'], $result['data']['cart']);
            }
            $fresh = new Store('test',
                new DatabaseSessionHandler(DB::connection(), 'sessions', 120, app()));
            $fresh->setId($session->getId());
            $fresh->start();
            $this->assertSame(['updated'], $fresh->get('marketplace.cart.v1'));
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop();
                }
            }
            foreach (glob($gate.'.*') ?: [] as $file) {
                unlink($file);
            }
        }
    }
}
