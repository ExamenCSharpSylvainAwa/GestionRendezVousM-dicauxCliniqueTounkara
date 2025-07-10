<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'nom',
        'prenom',
        'email',
        'telephone',
        'password',
        'role',
        'actif'
    ];



    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'actif' => 'boolean',
        'date_creation' => 'datetime',
        'email_verified_at' => 'datetime', // Ajout si vous avez cette colonne
    ];
    public function getDateCreationAttribute()
    {
        return $this->created_at;
    }

    // Relations
    public function patient()
    {
        return $this->hasOne(Patient::class);
    }

    public function medecin()
    {
        return $this->hasOne(Medecin::class);
    }

    public function personnel()
    {
        return $this->hasOne(Personnel::class);
    }

    public function administrateur()
    {
        return $this->hasOne(Administrateur::class);
    }

    // Méthodes utilitaires pour vérifier les rôles
    public function isPatient()
    {
        return $this->role === 'patient';
    }

    public function isMedecin()
    {
        return $this->role === 'medecin';
    }

    public function isPersonnel()
    {
        return $this->role === 'personnel';
    }

    public function isAdministrateur()
    {
        return $this->role === 'administrateur';
    }

    // Scope pour filtrer par rôle
    public function scopeByRole($query, $role)
    {
        return $query->where('role', $role);
    }

    // Scope pour les utilisateurs actifs
    public function scopeActive($query)
    {
        return $query->where('actif', true);
    }
}
