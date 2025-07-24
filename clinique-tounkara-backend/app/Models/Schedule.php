<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id', 'day_of_week', 'is_available', 'start_time', 'end_time', 'break_start', 'end_break'
    ];
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
