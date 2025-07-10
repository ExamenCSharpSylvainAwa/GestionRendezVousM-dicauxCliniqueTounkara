<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medicament extends Model
{
    use HasFactory;
    protected $fillable = ['nom', 'posologie', 'duree', 'instructions'];

    public function prescriptions()
    {
        return $this->belongsToMany(Prescription::class);
    }
}
