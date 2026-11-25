<?php

namespace Database\Seeders;

use App\Models\ArtworkSale;
use App\Models\StudentCourseEnrollment;
use App\Models\StudentFee;
use App\Models\StudioMembership;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StudentDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException('Student demo data is available only in local and testing environments.');
        }

        $password = getenv('ARTSPACE_DEMO_PASSWORD');
        if (! is_string($password) || strlen($password) < 12 || strlen($password) > 72) {
            throw new RuntimeException('Set ARTSPACE_DEMO_PASSWORD to a local demo password of 12 to 72 bytes.');
        }

        DB::transaction(function () use ($password) {
            foreach (['one', 'two'] as $number) {
                $username = 'portal-demo-'.$number;
                $student = User::where('email', $username.'@example.test')->first();

                if ($student && ($student->username !== $username || $student->role !== 'student')) {
                    throw new RuntimeException('An existing account conflicts with the student demo fixtures.');
                }

                if (! $student) {
                    $student = new User([
                        'name' => 'Portal Demo '.ucfirst($number),
                        'email' => $username.'@example.test',
                        'password' => $password,
                    ]);
                    $student->username = $username;
                    $student->role = 'student';
                    $student->save();
                }

                $courseName = $number === 'one' ? 'Drawing Fundamentals' : 'Printmaking';
                $course = StudentCourseEnrollment::firstOrCreate(['user_id' => $student->id, 'name' => $courseName]);
                $studio = StudioMembership::firstOrCreate(
                    ['user_id' => $student->id, 'name' => 'Open Studio'],
                    ['expires_on' => today()->addMonths(3)->toDateString()],
                );

                StudentFee::firstOrCreate(
                    ['user_id' => $student->id, 'student_course_enrollment_id' => $course->id, 'type' => 'Course'],
                    ['label' => $course->name, 'amount_minor' => 180000, 'due_date' => today()->addMonth()->toDateString()],
                );
                StudentFee::firstOrCreate(
                    ['user_id' => $student->id, 'studio_membership_id' => $studio->id, 'type' => 'Studio'],
                    ['label' => $studio->name, 'amount_minor' => 60000, 'due_date' => today()->addMonth()->toDateString()],
                );

                ArtworkSale::firstOrCreate(
                    ['user_id' => $student->id, 'artwork_title' => 'Demo sale: '.ucfirst($number)],
                    [
                        'price_minor' => $number === 'one' ? 120000 : 80000,
                        'sold_on' => today()->subWeek()->toDateString(),
                        'paid_on' => $number === 'one' ? today()->toDateString() : null,
                    ],
                );
            }
        });
    }
}
