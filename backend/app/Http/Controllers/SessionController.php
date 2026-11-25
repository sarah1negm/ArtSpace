<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class SessionController extends Controller
{
    public function show(Request $request)
    {
        return ['user' => $this->identity($request->user())];
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:254'],
            'password' => ['required', 'string', function ($attribute, $value, $fail) {
                if (strlen($value) > 72) {
                    $fail('The password is too long.');
                }
            }],
        ]);
        $identifier = strtolower($data['identifier']);
        $field = str_contains($identifier, '@') ? 'email' : 'username';
        abort_unless(Auth::guard('web')->attempt([
            $field => $identifier,
            'password' => $data['password'],
            fn ($query) => $query->whereIn('role', ['student', 'accountant', 'admin']),
        ]), 401);
        $request->session()->regenerate();

        return $this->show($request);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function register(Request $request)
    {
        $request->merge([
            'username' => strtolower($request->string('username')->toString()),
            'email' => strtolower($request->string('email')->toString()),
        ]);
        $data = $request->validate([
            ...$this->profileRules(),
            'username' => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-z0-9_]+$/', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/', function ($attribute, $value, $fail) {
                if (strlen($value) > 72) {
                    $fail('The password must be at most 72 bytes.');
                }
            }],
            'cardLast4' => ['nullable', 'digits:4'],
        ]);

        $user = new User(['password' => $data['password']]);
        $user->username = $data['username'];
        $user->role = 'student';
        $user->card_last4 = $data['cardLast4'] ?? null;
        $this->saveProfile($user, $data);

        return response()->noContent(201);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $request->merge(['email' => strtolower($request->string('email')->toString())]);
        $this->saveProfile($user, $request->validate($this->profileRules($user)));

        return $this->show($request);
    }

    private function profileRules(?User $user = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:254', Rule::unique('users')->ignore($user?->id)],
            'picture' => ['nullable', 'string', 'max:409650', 'regex:~\Adata:image/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}\z~'],
            'preferences.theme' => ['required', Rule::in(['light', 'dark'])],
            'preferences.newsletter' => ['required', 'boolean'],
        ];
    }

    private function saveProfile(User $user, array $data): void
    {
        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->picture = $data['picture'] ?? null;
        $user->preferences = [
            'theme' => $data['preferences']['theme'],
            'newsletter' => (bool) $data['preferences']['newsletter'],
        ];
        $user->save();
    }

    private function identity(?User $user): ?array
    {
        if (! $user || ! in_array($user->role, ['student', 'accountant', 'admin'], true)) {
            return null;
        }

        return [
            'id' => (string) $user->id,
            'username' => $user->username ?? '',
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'picture' => $user->picture ?? '',
            'cardLast4' => $user->card_last4 ?? '',
            'preferences' => $user->preferences ?? ['theme' => 'light', 'newsletter' => false],
        ];
    }
}
