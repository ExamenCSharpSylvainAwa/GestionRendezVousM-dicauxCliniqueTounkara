<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medicament extends Model
{
    use HasFactory;
    protected $fillable = ['prescription_id', 'nom', 'posologie', 'duree', 'instructions'];

    public function prescription()
    {
        return $this->belongsTo(Prescription::class);
    }
}
