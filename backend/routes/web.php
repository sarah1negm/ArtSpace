<?php

use App\Http\Controllers\SessionController;
use App\Http\Controllers\MarketplaceController;
use App\Http\Controllers\StudentArtworkController;
use App\Http\Controllers\StudentPortalController;
use App\Http\Middleware\RequireStudent;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => 'Queens Art API']));

Route::prefix('api/auth')->middleware('cache.headers:no_store')->group(function () {
    Route::get('session', [SessionController::class, 'show']);
    Route::post('session', [SessionController::class, 'login'])->middleware('throttle:8,1');
    Route::delete('session', [SessionController::class, 'logout']);
    Route::post('register', [SessionController::class, 'register'])->middleware('throttle:8,1');
    Route::patch('profile', [SessionController::class, 'updateProfile'])->middleware('auth:web');
});

Route::prefix('api')->group(function () {
    Route::prefix('cart')->middleware('cache.headers:no_store')->group(function () {
        Route::get('/', [MarketplaceController::class, 'show']);
        Route::post('items', [MarketplaceController::class, 'add']);
        Route::patch('items/{id}', [MarketplaceController::class, 'update'])->whereUuid('id');
        Route::delete('items/{id}', [MarketplaceController::class, 'remove'])->whereUuid('id');
        Route::delete('/', [MarketplaceController::class, 'clear']);
        Route::post('checkout', [MarketplaceController::class, 'checkout'])
            ->middleware(['auth:web', 'throttle:20,1']);
    });
    Route::get('artworks', [StudentArtworkController::class, 'catalogue']);
    Route::get('artwork-images/{filename}', [StudentArtworkController::class, 'image'])
        ->where('filename', '[A-Za-z0-9]+\.(jpg|jpeg|png|webp|gif)');

    Route::prefix('student')->middleware(['auth:web', RequireStudent::class, 'cache.headers:no_store'])->group(function () {
        Route::get('dashboard', [StudentPortalController::class, 'dashboard']);
        Route::get('fees', [StudentPortalController::class, 'fees']);
        Route::get('invoices', [StudentPortalController::class, 'invoices']);
        Route::post('invoices', [StudentPortalController::class, 'createInvoice']);
        Route::get('invoices/{id}', [StudentPortalController::class, 'invoice'])->whereNumber('id');
        Route::post('invoices/{id}/payments', [StudentPortalController::class, 'pay'])->whereNumber('id');
        Route::get('sales', [StudentPortalController::class, 'sales']);
        Route::get('artworks', [StudentArtworkController::class, 'index']);
        Route::post('artworks', [StudentArtworkController::class, 'store']);
        Route::patch('artworks/{id}', [StudentArtworkController::class, 'update'])->whereUuid('id');
        Route::delete('artworks/{id}', [StudentArtworkController::class, 'destroy'])->whereUuid('id');
    });
});
