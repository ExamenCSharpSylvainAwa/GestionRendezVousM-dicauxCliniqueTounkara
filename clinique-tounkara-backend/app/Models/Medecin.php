<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medecin extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id', 'specialite', 'numero_ordre', 'horaire_consultation', 'tarif_consultation', 'disponible'
    ];

    protected $casts = [
        'horaire_consultation' => 'array',
        'disponible' => 'boolean',
        'tarif_consultation' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function rendezVous()
    {
        return $this->hasMany(RendezVous::class);
    }
}
