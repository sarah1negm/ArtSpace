<?php

namespace App\Http\Controllers;

use App\Models\Artwork;
use App\Models\ArtworkSale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class MarketplaceController extends Controller
{
    // A listing is a unique original: its maximum purchasable quantity is one.
    private const CART = 'marketplace.cart.v1';

    public function show(Request $request): array
    {
        return $this->cartData($request);
    }

    public function add(Request $request): array
    {
        $input = $request->validate(['artworkId' => ['required', 'uuid']]);
        $artwork = Artwork::whereDoesntHave('sale')->find($input['artworkId']);
        abort_unless($artwork, 409, 'This artwork is no longer available. Refresh the gallery.');
        $ids = $request->session()->get(self::CART, []);
        if (! in_array($artwork->id, $ids, true)) {
            abort_if(count($ids) >= 50, 422, 'Your cart can contain at most 50 artworks.');
            $ids[] = $artwork->id;
            $request->session()->put(self::CART, $ids);
        }

        return $this->cartData($request);
    }

    public function update(Request $request, string $id): array
    {
        $request->validate(['quantity' => ['required', 'integer', 'in:1']]);
        abort_unless(in_array($id, $request->session()->get(self::CART, []), true), 404);

        return $this->cartData($request);
    }

    public function remove(Request $request, string $id): array
    {
        $request->session()->put(self::CART, array_values(array_diff(
            $request->session()->get(self::CART, []), [$id],
        )));

        return $this->cartData($request);
    }

    public function clear(Request $request): array
    {
        $request->session()->put(self::CART, []);

        return $this->cartData($request);
    }

    public function checkout(Request $request): array
    {
        $input = $request->validate([
            'requestId' => ['required', 'uuid'],
            'expectedTotalMinor' => ['sometimes', 'integer', 'min:1'],
        ]);
        $receipts = $request->session()->get('marketplace.receipts.v1', []);
        $receiptKey = $request->user()->id.':'.$input['requestId'];
        // Retrying an uncertain response must not create another sale or clear a new cart.
        if (isset($receipts[$receiptKey])) {
            return $receipts[$receiptKey] + ['cart' => $this->cartData($request)];
        }
        $ids = $request->session()->get(self::CART, []);
        if (! $ids) {
            throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
        }
        sort($ids); // Consistent lock ordering prevents multi-item deadlocks.
        // The receipt, cleared cart and sales must commit on ONE connection.
        // A separate Redis/file/cookie session cannot provide this guarantee.
        $testSession = app()->runningUnitTests() && config('session.driver') === 'array';
        abort_unless($testSession || (config('session.driver') === 'database' &&
            (config('session.connection') ?: config('database.default')) === config('database.default')),
            503, 'Checkout requires database sessions on the application database connection.');
        $previousSession = $request->session()->all();
        try {
            $receipt = DB::transaction(function () use ($ids, $request, $input, $receipts, $receiptKey) {
                $artworks = Artwork::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
                abort_unless($artworks->count() === count($ids), 409, 'An artwork was removed. Review your cart.');
                $total = 0;
                $sales = [];
                foreach ($artworks as $artwork) {
                    abort_if(ArtworkSale::where('artwork_id', $artwork->id)->exists(), 409,
                        'An artwork has already sold. Review your cart.');
                    abort_if($artwork->user_id === $request->user()->id, 422,
                        'You cannot purchase your own artwork. Remove it from your cart.');
                    $sale = ArtworkSale::create([
                        'user_id' => $artwork->user_id,
                        'artwork_id' => $artwork->id,
                        'artwork_title' => $artwork->title,
                        'price_minor' => $artwork->price_minor,
                        'sold_on' => today()->toDateString(),
                        'paid_on' => null,
                    ]);
                    $total += $artwork->price_minor;
                    $sales[] = (string) $sale->id;
                }
                // An optional displayed-total check prevents surprising a buyer after a
                // seller changes a price. It never authorizes the client to set prices.
                abort_if(isset($input['expectedTotalMinor']) && (int) $input['expectedTotalMinor'] !== $total,
                    409, 'Artwork prices changed. Reload your cart and confirm the updated total.');

                $receipt = ['requestId' => $input['requestId'], 'saleIds' => $sales,
                    'total' => $total / 100, 'quantity' => count($ids), 'simulated' => true];
                $request->session()->put(self::CART, []);
                $receipts[$receiptKey] = $receipt;
                $request->session()->put('marketplace.receipts.v1', array_slice($receipts, -10, null, true));
                // Saving here enlists the database session write in this transaction.
                // Middleware will save the same state again after the response.
                $request->session()->save();

                return $receipt;
            });
        } catch (Throwable $error) {
            // Exception rendering middleware may still save the session: restore
            // its original state after a transaction/session persistence failure.
            $request->session()->replace($previousSession);
            throw $error;
        }

        // Session locking serializes this buyer's cart; row locks + the existing UNIQUE
        // artwork_sales.artwork_id constraint protect against competing buyers.
        return $receipt + ['cart' => $this->cartData($request)];
    }

    private function cartData(Request $request): array
    {
        $ids = $request->session()->get(self::CART, []);
        $artworks = Artwork::with('artist')->whereIn('id', $ids)->whereDoesntHave('sale')->get()->keyBy('id');
        $items = [];
        $unavailable = [];
        $total = 0;
        foreach ($ids as $id) {
            $artwork = $artworks->get($id);
            if (! $artwork) {
                $unavailable[] = $id;

                continue;
            }
            $items[] = ['artwork' => [
                'id' => $artwork->id, 'title' => $artwork->title,
                'artist' => $artwork->artist->name, 'description' => $artwork->description,
                'category' => $artwork->category, 'price' => $artwork->price_minor / 100,
                'image' => $artwork->image_path ? '/api/artwork-images/'.basename($artwork->image_path) : $artwork->image_url,
                'popularity' => 0,
            ], 'quantity' => 1];
            $total += $artwork->price_minor;
        }

        return ['lines' => $items, 'total' => $total / 100, 'unavailableIds' => $unavailable];
    }
}
