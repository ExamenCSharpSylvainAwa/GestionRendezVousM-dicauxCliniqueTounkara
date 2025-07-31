<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Prescription extends Model
{
    use HasFactory;
    protected $fillable = ['consultation_id', 'date_emission', 'date_expiration', 'description'];

    protected $casts = [
        'date_emission' => 'date',
        'date_expiration' => 'date',
    ];

    public function consultation()
    {
        return $this->belongsTo(Consultation::class);
    }

    public function medicaments()
    {
        return $this->hasMany(Medicament::class);
    }
}
