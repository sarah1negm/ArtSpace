<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Artwork extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = ['user_id', 'title', 'description', 'category', 'price_minor', 'image_url', 'image_path'];

    public function artist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function sale(): HasOne
    {
        return $this->hasOne(ArtworkSale::class);
    }
}
