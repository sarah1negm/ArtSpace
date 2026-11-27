<?php

namespace Tests\Feature;

use App\Http\Controllers\MarketplaceController;
use App\Models\Artwork;
use App\Models\ArtworkSale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Str;
use Tests\TestCase;

class MarketplaceTest extends TestCase
{
    use RefreshDatabase;

    private function artwork(int $price = 12345): Artwork
    {
        return Artwork::create(['user_id' => User::factory()->create(['role' => 'student'])->id,
            'title' => 'Original artwork', 'description' => 'Student painting', 'category' => 'Painting',
            'price_minor' => $price, 'image_url' => 'https://example.test/painting.png']);
    }

    public function test_public_catalogue_excludes_deleted_and_sold_artworks(): void
    {
        $active = $this->artwork();
        $deleted = $this->artwork();
        $deleted->delete();
        $sold = $this->artwork();
        ArtworkSale::create(['user_id' => $sold->user_id, 'artwork_id' => $sold->id,
            'artwork_title' => $sold->title, 'price_minor' => 12345, 'sold_on' => today()]);
        $this->getJson('/api/artworks')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $active->id);
    }

    public function test_guest_cart_persists_and_uses_database_prices_and_unique_quantities(): void
    {
        $artwork = $this->artwork();
        $this->getJson('/api/cart')->assertOk()->assertJsonPath('lines', []);
        $this->postJson('/api/cart/items', ['artworkId' => $artwork->id, 'price' => 0.01, 'quantity' => 99])
            ->assertOk()->assertJsonPath('total', 123.45)->assertJsonPath('lines.0.quantity', 1);
        $this->postJson('/api/cart/items', ['artworkId' => $artwork->id])->assertOk()->assertJsonCount(1, 'lines');
        $this->getJson('/api/cart')->assertJsonPath('lines.0.artwork.id', $artwork->id);
        $this->patchJson('/api/cart/items/'.$artwork->id, ['quantity' => 2])->assertUnprocessable();
        $this->patchJson('/api/cart/items/'.$artwork->id, ['quantity' => 1])->assertOk();
        $this->deleteJson('/api/cart/items/'.$artwork->id)->assertOk()->assertJsonPath('total', 0);
    }

    public function test_invalid_ids_unavailable_items_and_session_isolation(): void
    {
        $this->postJson('/api/cart/items', ['artworkId' => 'bad'])->assertUnprocessable();
        $this->postJson('/api/cart/items', ['artworkId' => Str::uuid()->toString()])->assertConflict();
        $artwork = $this->artwork();
        $this->postJson('/api/cart/items', ['artworkId' => $artwork->id])->assertOk();
        $artwork->delete();
        $this->getJson('/api/cart')->assertJsonPath('unavailableIds.0', $artwork->id)->assertJsonPath('lines', []);
        $this->deleteJson('/api/cart')->assertJsonPath('unavailableIds', []);
        $this->flushSession();
        $this->getJson('/api/cart')->assertJsonPath('lines', []);
    }

    public function test_checkout_requires_authentication_and_does_not_allow_self_purchase(): void
    {
        $artwork = $this->artwork();
        $this->postJson('/api/cart/items', ['artworkId' => $artwork->id]);
        $this->postJson('/api/cart/checkout', ['requestId' => Str::uuid()])->assertUnauthorized();
        $this->actingAs(User::findOrFail($artwork->user_id))
            ->postJson('/api/cart/checkout', ['requestId' => Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('artwork_sales', 0);
        $this->getJson('/api/cart')->assertJsonCount(1, 'lines');
    }

    public function test_checkout_is_authoritative_atomic_and_idempotent_and_updates_student_sales(): void
    {
        $artwork = $this->artwork(10001);
        $buyer = User::factory()->create(['role' => 'student']);
        $this->actingAs($buyer)->postJson('/api/cart/items', ['artworkId' => $artwork->id]);
        $artwork->update(['price_minor' => 20001]);
        $key = Str::uuid()->toString();
        $receipt = $this->postJson('/api/cart/checkout', ['requestId' => $key, 'total' => 1])
            ->assertOk()->assertJsonPath('total', 200.01)->assertJsonPath('simulated', true)->json();
        $this->postJson('/api/cart/checkout', ['requestId' => $key])->assertExactJson($receipt);
        $this->assertDatabaseCount('artwork_sales', 1);
        $this->getJson('/api/cart')->assertJsonPath('lines', []);
        $this->getJson('/api/artworks')->assertExactJson([]);
        $this->actingAs(User::findOrFail($artwork->user_id))->getJson('/api/student/sales')
            ->assertJsonPath('sales.0.commission', 30)->assertJsonPath('sales.0.earnings', 170.01)
            ->assertJsonPath('sales.0.payoutStatus', 'Pending');
    }

    public function test_competing_purchase_fails_without_partial_sales_or_clearing_the_cart(): void
    {
        $first = $this->artwork();
        $second = $this->artwork();
        $this->actingAs(User::factory()->create());
        foreach ([$first, $second] as $artwork) {
            $this->postJson('/api/cart/items', ['artworkId' => $artwork->id]);
        }
        ArtworkSale::create(['user_id' => $second->user_id, 'artwork_id' => $second->id,
            'artwork_title' => $second->title, 'price_minor' => $second->price_minor, 'sold_on' => today()]);
        $this->postJson('/api/cart/checkout', ['requestId' => Str::uuid()])->assertConflict();
        $this->assertDatabaseCount('artwork_sales', 1);
        $this->assertDatabaseMissing('artwork_sales', ['artwork_id' => $first->id]);
        $this->getJson('/api/cart')->assertJsonPath('unavailableIds.0', $second->id)->assertJsonCount(1, 'lines');
    }

    public function test_empty_checkout_and_bad_request_keys_are_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/cart/checkout', [])->assertUnprocessable();
        $this->postJson('/api/cart/checkout', ['requestId' => Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('artwork_sales', 0);
    }

    public function test_a_changed_displayed_price_requires_review_without_recording_a_sale(): void
    {
        $artwork = $this->artwork();
        $this->actingAs(User::factory()->create())->postJson('/api/cart/items', ['artworkId' => $artwork->id]);
        $artwork->update(['price_minor' => 20000]);
        $key = Str::uuid()->toString();
        $this->postJson('/api/cart/checkout', ['requestId' => $key, 'expectedTotalMinor' => 12345])->assertConflict();
        $this->assertDatabaseCount('artwork_sales', 0);
        $this->getJson('/api/cart')->assertJsonCount(1, 'lines')->assertJsonPath('total', 200);
        $this->postJson('/api/cart/checkout', ['requestId' => $key, 'expectedTotalMinor' => 20000])
            ->assertOk()->assertJsonPath('total', 200);
        $this->assertDatabaseCount('artwork_sales', 1);
    }

    public function test_guest_cart_survives_login_but_logout_ends_that_session_cart(): void
    {
        User::factory()->create(['username' => 'market-buyer', 'role' => 'student']);
        $artwork = $this->artwork();
        $this->postJson('/api/cart/items', ['artworkId' => $artwork->id])->assertOk();
        $this->postJson('/api/auth/session', ['identifier' => 'market-buyer', 'password' => 'password'])->assertOk();
        $this->getJson('/api/cart')->assertJsonPath('lines.0.artwork.id', $artwork->id);
        $this->deleteJson('/api/auth/session')->assertNoContent();
        $this->getJson('/api/cart')->assertJsonPath('lines', []);
    }

    public function test_receipt_replay_is_buyer_scoped_and_preserves_a_new_cart(): void
    {
        $first = $this->artwork();
        $next = $this->artwork();
        $buyer = User::factory()->create();
        $key = Str::uuid()->toString();
        $this->actingAs($buyer)->postJson('/api/cart/items', ['artworkId' => $first->id]);
        $receipt = $this->postJson('/api/cart/checkout', ['requestId' => $key])->assertOk()->json();
        $this->postJson('/api/cart/items', ['artworkId' => $next->id]);
        $this->postJson('/api/cart/checkout', ['requestId' => $key])->assertOk()
            ->assertJsonPath('saleIds', $receipt['saleIds'])->assertJsonPath('cart.lines.0.artwork.id', $next->id);
        $this->actingAs(User::factory()->create())->postJson('/api/cart/checkout', ['requestId' => $key])
            ->assertOk()->assertJsonMissing(['saleIds' => $receipt['saleIds']]);
        $this->assertDatabaseCount('artwork_sales', 2);
    }

    public function test_a_session_write_failure_rolls_back_sales_and_restores_cart_and_receipts(): void
    {
        $artwork = $this->artwork();
        $buyer = User::factory()->create();
        $session = \Mockery::mock(Store::class)->makePartial();
        $session->__construct('test', new ArraySessionHandler(120));
        $session->start();
        $session->put('marketplace.cart.v1', [$artwork->id]);
        $before = $session->all();
        $session->shouldReceive('save')->once()->andThrow(new \RuntimeException('Simulated session write failure'));
        $request = Request::create('/api/cart/checkout', 'POST', ['requestId' => Str::uuid()->toString()]);
        $request->setLaravelSession($session);
        $request->setUserResolver(fn () => $buyer);
        try {
            app(MarketplaceController::class)->checkout($request);
            $this->fail('Checkout should not succeed when its session cannot be saved.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Simulated session write failure', $error->getMessage());
        }
        $this->assertDatabaseCount('artwork_sales', 0);
        $this->assertSame($before, $session->all());
    }

    public function test_all_web_session_requests_use_the_shared_lock(): void
    {
        $this->assertTrue(config('session.block'));
        $this->assertGreaterThanOrEqual(120, config('session.block_lock_seconds'));
    }

    public function test_checkout_commission_rounds_half_piasters_using_integer_arithmetic(): void
    {
        foreach ([[1, 0, 0.01], [3, 0, 0.03], [10, 0.02, 0.08], [150, 0.23, 1.27], [190, 0.29, 1.61], [390, 0.59, 3.31], [12345, 18.52, 104.93]] as [$price, $commission, $earnings]) {
            $artwork = $this->artwork($price);
            $this->actingAs(User::factory()->create())->postJson('/api/cart/items', ['artworkId' => $artwork->id]);
            $this->postJson('/api/cart/checkout', ['requestId' => Str::uuid()->toString()])->assertOk();
            $this->actingAs(User::findOrFail($artwork->user_id))->getJson('/api/student/sales')
                ->assertJsonPath('sales.0.commission', $commission)->assertJsonPath('sales.0.earnings', $earnings);
        }
    }
}
