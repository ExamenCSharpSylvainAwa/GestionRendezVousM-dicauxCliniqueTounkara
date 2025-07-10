<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RendezVous extends Model
{
    use HasFactory;
    protected $fillable = ['patient_id', 'medecin_id', 'date_heure', 'motif', 'statut', 'rappel_envoye', 'tarif'];

    protected $casts = [
        'date_heure' => 'datetime',
        'rappel_envoye' => 'boolean',
        'tarif' => 'decimal:2',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function medecin()
    {
        return $this->belongsTo(Medecin::class);
    }

    public function paiement()
    {
        return $this->hasOne(Paiement::class);
    }
}
