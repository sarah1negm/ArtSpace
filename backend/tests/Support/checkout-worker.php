<?php

use App\Http\Controllers\MarketplaceController;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

// Independent PHP process: uses the same checkout controller and real MySQL locks.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || ! str_ends_with(config('database.connections.mysql.database'), '_marketplace_test')) {
    fwrite(STDERR, 'This worker requires an isolated marketplace test database.');
    exit(2);
}
if (! str_ends_with(DB::connection()->getDatabaseName(), '_marketplace_test')) {
    exit(2);
}
[$script, $artwork, $buyer, $gate, $worker] = $argv;
if ($artwork === 'session-probe') {
    config(['session.driver' => 'database', 'cache.default' => 'database']);
    Route::get('/api/test-session-lock', function (Request $request) use ($gate, $worker) {
        file_put_contents($gate.'.'.$worker.'.loaded', 'loaded');
        if ($worker === '0') {
            $deadline = microtime(true) + 15;
            while (! file_exists($gate.'.release')) {
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Session probe timed out.');
                }
                usleep(10000);
            }
            $request->session()->put('marketplace.cart.v1', ['updated']);
        }

        return ['cart' => $request->session()->get('marketplace.cart.v1')];
    })->middleware('web');
    $name = config('session.cookie');
    $value = CookieValuePrefix::create($name, $app['encrypter']->getKey()).$buyer;
    $encrypted = $app['encrypter']->encrypt($value, false);
    $request = Request::create('/api/test-session-lock', 'GET', [], [$name => $encrypted], [], ['HTTP_ACCEPT' => 'application/json']);
    file_put_contents($gate.'.'.$worker.'.started', 'started');
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $response = $kernel->handle($request);
    echo json_encode(['status' => $response->getStatusCode(), 'data' => json_decode($response->getContent(), true)]);
    $kernel->terminate($request, $response);
    exit;
}
$request = Request::create('/api/cart/checkout', 'POST', ['requestId' => Str::uuid()->toString()]);
$session = new Store('test', new ArraySessionHandler(120));
$session->start();
$session->put('marketplace.cart.v1', [$artwork]);
$request->setLaravelSession($session);
$request->setUserResolver(fn () => User::findOrFail($buyer));
file_put_contents($gate.'.'.$worker.'.ready', 'ready');
$deadline = microtime(true) + 20;
while (! file_exists($gate.'.go')) {
    if (microtime(true) > $deadline) {
        exit(3);
    }
    usleep(10000);
}
try {
    $receipt = $app->make(MarketplaceController::class)->checkout($request);
    echo json_encode(['status' => 200, 'quantity' => $receipt['quantity']]);
} catch (HttpException $error) {
    echo json_encode(['status' => $error->getStatusCode()]);
} catch (Throwable $error) {
    echo json_encode(['status' => 500, 'type' => $error::class]);
    exit(1);
}
