<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Facture extends Model
{
    use HasFactory;
    protected $fillable = ['paiement_id', 'numero', 'date_emission', 'date_echeance', 'montant_total', 'tva', 'statut', 'details_facture'];

    protected $casts = [
        'date_emission' => 'date',
        'date_echeance' => 'date',
        'montant_total' => 'decimal:2',
        'tva' => 'decimal:2',
        'details_facture' => 'array',
    ];

    public function paiement()
    {
        return $this->belongsTo(Paiement::class);
    }
}
