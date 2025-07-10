<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Prescription extends Model
{
    use HasFactory;
    protected $fillable = ['consultation_id', 'date_emission', 'date_expiration', 'description', 'medicaments'];

    protected $casts = [
        'date_emission' => 'date',
        'date_expiration' => 'date',
        'medicaments' => 'array',
    ];

    public function consultation()
    {
        return $this->belongsTo(Consultation::class);
    }
}
