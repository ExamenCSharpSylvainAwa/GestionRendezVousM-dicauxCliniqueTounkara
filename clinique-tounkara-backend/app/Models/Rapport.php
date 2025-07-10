<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Rapport extends Model
{
    use HasFactory;
    protected $fillable = ['titre', 'date_generation', 'type', 'contenu', 'format'];

    protected $casts = ['date_generation' => 'date'];

    public function administrateur()
    {
        return $this->belongsTo(Administrateur::class);
    }
}
