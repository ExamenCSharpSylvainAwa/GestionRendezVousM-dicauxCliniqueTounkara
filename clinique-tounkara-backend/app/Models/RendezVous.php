<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RendezVous extends Model
{
    use HasFactory;

    // Nom de la table associée au modèle
    protected $table = 'rendez_vous';

    /**
     * Les attributs qui peuvent être massivement assignés.
     * Le champ 'statut' est déjà inclus ici, ce qui est correct.
     * 'tarif' est aussi bien inclus ici.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'patient_id',
        'medecin_id',
        'date_heure',
        'motif',
        'statut',        // Champ 'statut' pour gérer l'état du rendez-vous
        'rappel_envoye', // Champ 'rappel_envoye' pour le suivi des rappels
        'tarif',    // Champ 'tarif' pour stocker le coût de la consultation
         'reason', // Pour les annulations
        'reschedule_reason', // Pour les reports
        'old_date_heure',
    ];

    /**
     * Les attributs qui devraient être castés.
     * 'date_heure' est casté en datetime, ce qui est essentiel pour les opérations de date/heure.
     * 'rappel_envoye' est casté en boolean.
     * 'tarif' est casté en decimal avec 2 décimales.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date_heure' => 'datetime',
        'rappel_envoye' => 'boolean',
        'tarif' => 'decimal:2',
        'old_date_heure' => 'datetime', // Caster aussi l'ancienne date/heure
    ];

    /**
     * Définit la relation "belongs to" avec le modèle Patient.
     * Un rendez-vous appartient à un patient.
     */
    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    /**
     * Définit la relation "belongs to" avec le modèle Medecin.
     * Un rendez-vous appartient à un médecin.
     */
    public function medecin()
    {
        return $this->belongsTo(Medecin::class);
    }

    /**
     * Définit la relation "has one" avec le modèle Paiement.
     * Un rendez-vous peut avoir un paiement associé.
     */

    public function paiements()
    {
        return $this->hasMany(Paiement::class, 'rendez_vous_id');
    }

    /**
     * Relation pour obtenir le dernier paiement
     */
    public function paiement()
    {
        return $this->hasOne(Paiement::class, 'rendez_vous_id')->latest();
    }
}

