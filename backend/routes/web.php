<?php

use App\Http\Controllers\StudentArtworkController;
use App\Http\Controllers\StudentPortalController;
use App\Http\Middleware\RequireStudent;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => 'ArtSpace API']));

Route::prefix('api')->group(function () {
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
