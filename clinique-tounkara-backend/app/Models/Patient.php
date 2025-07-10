<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id', 'numero_assurance', 'adresse', 'date_naissance', 'sexe', 'groupe_sanguin', 'antecedent_medicaux'
    ];

    protected $casts = [
        'date_naissance' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function dossierMedical()
    {
        return $this->hasOne(DossierMedical::class);
    }

    public function rendezVous()
    {
        return $this->hasMany(RendezVous::class);
    }
}
