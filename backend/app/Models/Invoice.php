<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Invoice extends Model
{
    protected $fillable = ['student_fee_id', 'amount_minor', 'issued_on'];

    public function payment(): HasOne
    {
        return $this->hasOne(InvoicePayment::class);
    }
}
