<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Consultation extends Model
{
    use HasFactory;
    protected $fillable = ['dossier_medical_id', 'date', 'symptomes', 'diagnostic', 'recommandations', 'notes'];

    protected $casts = ['date' => 'date'];

    public function dossierMedical()
    {
        return $this->belongsTo(DossierMedical::class);
    }

    public function prescriptions()
    {
        return $this->hasMany(Prescription::class);
    }
}
