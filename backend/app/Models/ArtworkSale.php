<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArtworkSale extends Model
{
    protected $fillable = ['user_id', 'artwork_id', 'artwork_title', 'price_minor', 'sold_on', 'paid_on'];
}
