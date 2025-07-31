<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\PaiementController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

Route::get('/paiement/callback', [PaiementController::class, 'callback'])->name('paydunya.callback');
Route::get('/paiement/success', function() {
    return view('paiement.success');
})->name('paydunya.success');
Route::get('/paiement/cancel', function() {
    return view('paiement.cancel');
})->name('paydunya.cancel');
Route::get('/paiement/error', function() {
    return view('paiement.error');
})->name('paydunya.error');
