<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SharedLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_accounts_use_the_same_session_contract_with_server_owned_roles(): void
    {
        foreach (['student', 'accountant', 'admin'] as $role) {
            $user = User::factory()->create(['username' => $role, 'role' => $role]);
            $this->postJson('/api/auth/session', ['identifier' => $user->email, 'password' => 'password'])
                ->assertOk()->assertJsonPath('user.role', $role)->assertJsonMissingPath('user.password');
            $this->getJson('/api/auth/session')->assertJsonPath('user.id', (string) $user->id);
            $this->getJson('/api/student/dashboard')->assertStatus($role === 'student' ? 200 : 403);
            $this->deleteJson('/api/auth/session')->assertNoContent();
            $this->getJson('/api/auth/session')->assertExactJson(['user' => null]);
            $this->getJson('/api/student/dashboard')->assertUnauthorized();
        }
    }

    public function test_registration_and_profile_updates_cannot_choose_a_privileged_role(): void
    {
        $profile = [
            'name' => 'Test Student',
            'email' => 'Student@example.test',
            'preferences' => ['theme' => 'dark', 'newsletter' => true],
            'role' => 'admin',
        ];
        $this->postJson('/api/auth/register', $profile + [
            'username' => 'TestStudent',
            'password' => 'StudentPass17',
            'cardLast4' => '0007',
        ])->assertCreated();

        $user = User::where('username', 'teststudent')->firstOrFail();
        $this->assertTrue(Hash::check('StudentPass17', $user->password));
        $this->assertGuest();
        $this->postJson('/api/auth/session', ['identifier' => 'teststudent', 'password' => 'wrong'])
            ->assertUnauthorized();
        $this->postJson('/api/auth/session', ['identifier' => 'TESTSTUDENT', 'password' => 'StudentPass17'])
            ->assertOk()->assertJsonPath('user.role', 'student')->assertJsonPath('user.cardLast4', '0007');
        $profile['name'] = 'Updated Name';
        $this->patchJson('/api/auth/profile', $profile)->assertOk()
            ->assertJsonPath('user.name', 'Updated Name')->assertJsonPath('user.role', 'student');
    }
}
