<?php

namespace App\Http\Controllers;

use App\Models\Artwork;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class StudentArtworkController extends Controller
{
    public function catalogue(): array
    {
        return Artwork::with('artist')->whereDoesntHave('sale')->latest()->get()
            ->map(fn (Artwork $artwork) => $this->artworkData($artwork) + [
                'artist' => $artwork->artist->name,
                'artistId' => (string) $artwork->user_id,
            ])->all();
    }

    public function index(Request $request): array
    {
        return Artwork::where('user_id', $request->user()->id)->latest()->get()
            ->map(fn (Artwork $artwork) => $this->artworkData($artwork))->all();
    }

    public function store(Request $request)
    {
        $artwork = new Artwork(['user_id' => $request->user()->id]);
        $this->persist($request, $artwork);

        return response()->json($this->artworkData($artwork), 201);
    }

    public function update(Request $request, string $id): array
    {
        $artwork = $this->ownedArtwork($request, $id);
        $this->persist($request, $artwork);

        return $this->artworkData($artwork);
    }

    public function destroy(Request $request, string $id)
    {
        $artwork = $this->ownedArtwork($request, $id);
        $artwork->delete();

        return response()->noContent();
    }

    public function image(string $filename)
    {
        $path = 'artworks/'.$filename;
        abort_unless(Artwork::where('image_path', $path)->exists() && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['X-Content-Type-Options' => 'nosniff']);
    }

    private function ownedArtwork(Request $request, string $id): Artwork
    {
        return Artwork::where('user_id', $request->user()->id)->findOrFail($id);
    }

    private function persist(Request $request, Artwork $artwork): void
    {
        $input = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category' => ['required', Rule::in(['Painting', 'Print', 'Other'])],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:10000000'],
            'imageUrl' => [$artwork->exists ? 'nullable' : 'required_without:image', 'nullable', 'url:http,https', 'max:2048'],
            'image' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:2048', 'dimensions:max_width=4096,max_height=4096'],
        ]);

        $image = $request->file('image');
        $imagePath = $image ? $image->store('artworks', 'local') : null;
        if ($image && ! $imagePath) {
            throw new RuntimeException('Could not store artwork image.');
        }

        try {
            $artwork->fill([
                'title' => $input['title'],
                'description' => $input['description'],
                'category' => $input['category'],
                'price_minor' => (int) round($input['price'] * 100),
            ]);
            if ($imagePath || isset($input['imageUrl'])) {
                $artwork->image_path = $imagePath;
                $artwork->image_url = $imagePath ? null : $input['imageUrl'];
            }
            $artwork->saveOrFail();
        } catch (Throwable $error) {
            if ($imagePath) {
                Storage::disk('local')->delete($imagePath);
            }
            throw $error;
        }
    }

    private function artworkData(Artwork $artwork): array
    {
        return [
            'id' => $artwork->id,
            'title' => $artwork->title,
            'description' => $artwork->description,
            'category' => $artwork->category,
            'price' => $artwork->price_minor / 100,
            'imageUrl' => $artwork->image_path
                ? '/api/artwork-images/'.basename($artwork->image_path)
                : $artwork->image_url,
        ];
    }
}
