<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;
    protected $fillable = ['type', 'contenu', 'date_envoi', 'envoye', 'statut', 'methode_envoi'];

    protected $casts = [
        'date_envoi' => 'date',
        'envoye' => 'boolean',
    ];

    public function rendezVous()
    {
        return $this->belongsTo(RendezVous::class);
    }
}
