<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StudentFee extends Model
{
    protected $fillable = ['user_id', 'student_course_enrollment_id', 'studio_membership_id', 'label', 'type', 'amount_minor', 'due_date'];

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }
}
