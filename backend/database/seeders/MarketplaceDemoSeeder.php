<?php

namespace Database\Seeders;

use App\Models\Artwork;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class MarketplaceDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException('Marketplace fixtures are local demo data only.');
        }
        $seller = User::where('username', 'portal-demo-one')->where('role', 'student')->first();
        if (! $seller) {
            throw new RuntimeException('Run StudentDemoSeeder first.');
        }
        foreach ([
            ['Sunset Dreams', 'Painting', 12000, 'sunset-dreams.svg', 'Warm evening light and quiet horizons.'],
            ['Ocean Waves', 'Print', 20000, 'ocean-waves.svg', 'Movement, depth, and the rhythm of the sea.'],
            ['Colorful World', 'Other', 15000, 'colorful-world.svg', 'Contrasting colors and playful forms.'],
        ] as [$title, $category, $price, $image, $description]) {
            // Never reset a sold, edited or soft-deleted listing when rerunning fixtures.
            Artwork::withTrashed()->firstOrCreate(['user_id' => $seller->id, 'title' => $title], [
                'category' => $category, 'price_minor' => $price, 'description' => $description,
                'image_url' => '/artworks/'.$image,
            ]);
        }
    }
}
