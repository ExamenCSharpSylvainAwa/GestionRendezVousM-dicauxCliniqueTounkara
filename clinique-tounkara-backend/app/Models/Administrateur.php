<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Administrateur extends Model
{
    use HasFactory;
    protected $fillable = ['user_id', 'niveau', 'permissions'];

    protected $casts = ['permissions' => 'array'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function rapports()
    {
        return $this->hasMany(Rapport::class);
    }
}
