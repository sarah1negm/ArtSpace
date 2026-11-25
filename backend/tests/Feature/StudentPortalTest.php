<?php

namespace Tests\Feature;

use App\Models\ArtworkSale;
use App\Models\StudentCourseEnrollment;
use App\Models\StudentFee;
use App\Models\StudioMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StudentPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_routes_require_a_student_session(): void
    {
        $this->get('/api/student/dashboard')->assertUnauthorized();
        $this->getJson('/api/student/dashboard')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/student/fees')->assertForbidden();
    }

    public function test_dashboard_returns_only_the_students_enrollments_membership_and_balance(): void
    {
        $student = $this->student();
        $other = $this->student();
        StudentCourseEnrollment::create(['user_id' => $student->id, 'name' => 'Drawing']);
        StudentCourseEnrollment::create(['user_id' => $other->id, 'name' => 'Private course']);
        StudioMembership::create(['user_id' => $student->id, 'name' => 'Open Studio', 'expires_on' => '2027-01-31']);
        $this->fee($student);
        $this->fee($other);

        $this->actingAs($student)->getJson('/api/student/dashboard')
            ->assertOk()->assertJsonPath('profile.name', $student->name)
            ->assertJsonPath('courses', ['Drawing'])
            ->assertJsonPath('membership.name', 'Open Studio')
            ->assertJsonPath('outstanding', 123.45)->assertJsonPath('totalPaid', 0);
    }

    public function test_invoice_creation_and_simulated_payment_are_idempotent_and_owned(): void
    {
        $student = $this->student();
        $other = $this->student();
        $fee = $this->fee($student);

        $created = $this->actingAs($student)->postJson('/api/student/invoices', ['feeId' => $fee->id])
            ->assertCreated()->assertJsonPath('amount', 123.45)->assertJsonPath('status', 'Unpaid');
        $uri = '/api/student/invoices/'.$created->json('id');
        $this->postJson('/api/student/invoices', ['feeId' => $fee->id])->assertOk();
        $this->getJson($uri)->assertOk();
        $this->postJson($uri.'/payments', ['amount' => 1])->assertOk()->assertJsonPath('status', 'Paid');
        $this->postJson($uri.'/payments')->assertOk();
        $this->assertDatabaseCount('invoice_payments', 1);
        $this->assertDatabaseHas('invoice_payments', ['amount_minor' => 12345]);
        $this->getJson('/api/student/fees')->assertOk()->assertJsonPath('outstanding', 0)
            ->assertJsonPath('fees.0.balance', 0)->assertJsonPath('paymentHistory.0.amount', 123.45);

        $this->actingAs($other)->postJson('/api/student/invoices', ['feeId' => $fee->id])->assertNotFound();
        $this->getJson($uri)->assertNotFound();
        $this->postJson($uri.'/payments')->assertNotFound();
        $this->getJson('/api/student/invoices')->assertExactJson([]);
    }

    public function test_artwork_changes_flow_through_the_public_catalogue_and_require_ownership(): void
    {
        $student = $this->student();
        $other = $this->student();
        $draft = $this->draft();
        $this->actingAs($student);
        $created = $this->postJson('/api/student/artworks', $draft)->assertCreated();
        $uri = '/api/student/artworks/'.$created->json('id');
        $this->getJson('/api/artworks')->assertJsonPath('0.artist', $student->name);
        $this->actingAs($other)->getJson('/api/student/artworks')->assertExactJson([]);
        $this->patchJson($uri, $draft)->assertNotFound();
        $this->deleteJson($uri)->assertNotFound();

        $this->actingAs($student)->patchJson($uri, ['title' => 'Updated'] + $draft)->assertOk();
        $this->getJson('/api/artworks')->assertJsonPath('0.title', 'Updated');
        $this->deleteJson($uri)->assertNoContent();
        $this->getJson('/api/artworks')->assertExactJson([]);
    }

    public function test_upload_checks_file_content_and_stores_an_image_path(): void
    {
        Storage::fake('local');
        $this->actingAs($this->student());
        $draft = $this->draft();
        unset($draft['imageUrl']);
        $this->postJson('/api/student/artworks', $draft + [
            'image' => UploadedFile::fake()->createWithContent('sample.png', 'not a PNG'),
        ])->assertUnprocessable()->assertJsonValidationErrors('image');

        $file = UploadedFile::fake()->createWithContent('sample.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg=='
        ));
        $created = $this->postJson('/api/student/artworks', $draft + ['image' => $file])->assertCreated();
        $this->get($created->json('imageUrl'))->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        Storage::disk('local')->assertExists('artworks/'.$file->hashName());
    }

    public function test_sales_are_private_and_commission_rounds_to_the_nearest_piaster(): void
    {
        $student = $this->student();
        $other = $this->student();
        foreach ([$student, $other] as $seller) {
            ArtworkSale::create([
                'user_id' => $seller->id,
                'artwork_title' => 'Sold artwork',
                'price_minor' => 1010,
                'sold_on' => '2026-11-01',
                'paid_on' => '2026-11-02',
            ]);
        }

        $this->actingAs($student)->getJson('/api/student/sales')->assertOk()->assertJsonCount(1, 'sales')
            ->assertJsonPath('sales.0.commission', 1.52)
            ->assertJsonPath('sales.0.payoutStatus', 'Paid')
            ->assertJsonPath('earnings', 8.58);
    }

    private function student(): User
    {
        return User::factory()->create(['role' => 'student']);
    }

    private function fee(User $student): StudentFee
    {
        return StudentFee::create([
            'user_id' => $student->id, 'label' => 'Studio fee', 'type' => 'Studio',
            'amount_minor' => 12345, 'due_date' => '2026-12-01',
        ]);
    }

    private function draft(): array
    {
        return [
            'title' => 'Drawing', 'description' => 'Graphite on paper', 'category' => 'Other',
            'price' => 123.45, 'imageUrl' => 'https://example.com/drawing.png',
        ];
    }
}
