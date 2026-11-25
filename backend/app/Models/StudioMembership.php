<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudioMembership extends Model
{
    protected $fillable = ['user_id', 'name', 'expires_on'];
}
