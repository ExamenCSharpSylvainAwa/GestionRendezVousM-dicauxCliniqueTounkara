<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Paiement extends Model
{
    use HasFactory;

    protected $table = 'paiements';

    protected $fillable = [
        'rendez_vous_id',
        'date',
        'montant',
        'statut',
        'reference',
        'paydunya_token',
    ];

    protected $casts = [
        'date' => 'date',
        'montant' => 'decimal:2',
    ];

    /**
     * Relation avec le rendez-vous
     */
    public function rendezVous()
    {
        return $this->belongsTo(RendezVous::class, 'rendez_vous_id');
    }

    /**
     * Alias pour la relation rendezVous (pour compatibilité)
     */
    public function rendez_vous()
    {
        return $this->belongsTo(RendezVous::class, 'rendez_vous_id');
    }

    /**
     * Relation avec la facture
     */
    public function facture()
    {
        return $this->hasOne(Facture::class, 'paiement_id');
    }
}
