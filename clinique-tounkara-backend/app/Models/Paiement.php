<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Paiement extends Model
{
    use HasFactory;protected $fillable = ['rendez_vous_id', 'date', 'montant', 'statut', 'reference'];

    protected $casts = [
        'date' => 'date',
        'montant' => 'decimal:2',
    ];

    public function rendezVous()
    {
        return $this->belongsTo(RendezVous::class);
    }

    public function facture()
    {
        return $this->hasOne(Facture::class);
    }

}
