<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LocalStudentSessionController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        return response()->json(['user' => $this->isDemoStudent($user) ? $this->identity($user) : null]);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:254'],
            'password' => ['required', 'string', 'max:72'],
        ]);
        $identifier = strtolower($data['identifier']);
        $username = str_replace('@example.test', '', $identifier);
        abort_unless(in_array($username, ['portal-demo-one', 'portal-demo-two'], true)
            && in_array($identifier, [$username, $username.'@example.test'], true), 401);

        abort_unless(Auth::guard('web')->attempt([
            'username' => $username,
            'email' => $username.'@example.test',
            'password' => $data['password'],
            'role' => 'student',
        ]), 401);
        $request->session()->regenerate();

        return response()->json(['user' => $this->identity($request->user())]);
    }

    public function logout(Request $request)
    {
        if ($this->isDemoStudent($request->user())) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->noContent();
    }

    private function isDemoStudent(?User $user): bool
    {
        return $user?->role === 'student'
            && in_array($user->username, ['portal-demo-one', 'portal-demo-two'], true)
            && $user->email === $user->username.'@example.test';
    }

    private function identity(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
        ];
    }
}
