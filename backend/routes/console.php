<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('artspace:create-user {username} {email} {role}', function () {
    $data = Validator::make([
        'username' => strtolower(trim($this->argument('username'))),
        'email' => strtolower(trim($this->argument('email'))),
        'role' => $this->argument('role'),
    ], [
        'username' => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-z0-9_]+$/', 'unique:users'],
        'email' => ['required', 'email', 'max:254', 'unique:users'],
        'role' => ['required', 'in:student,accountant,admin'],
    ]);
    if ($data->fails()) {
        $this->error($data->errors()->first());
        return 1;
    }

    $password = $this->secret('Password');
    if (! is_string($password) || strlen($password) < 12 || strlen($password) > 72
        || $password !== $this->secret('Confirm password')) {
        $this->error('Enter matching passwords of 12 to 72 bytes.');
        return 1;
    }

    $account = $data->validated();
    $user = new User(['name' => $account['username'], 'email' => $account['email'], 'password' => $password]);
    $user->username = $account['username'];
    $user->role = $account['role'];
    $user->save();
    $this->info('Account created.');

    return 0;
})->purpose('Create an ArtSpace account with a server-assigned role');
