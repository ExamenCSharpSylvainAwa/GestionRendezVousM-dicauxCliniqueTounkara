<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ScheduleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        try {
            $userId = $request->query('user_id');
            $date = $request->query('date');
            $dayOfWeek = $request->query('day_of_week'); // Nouveau paramètre

            // Validation des paramètres
            if (!$userId) {
                return response()->json(['error' => 'user_id is required'], 400);
            }

            if ($date) {
                // Si une date est spécifiée, générer les créneaux pour cette date
                return $this->getScheduleForDate($userId, $date);
            } elseif ($dayOfWeek) {
                // Si un jour de la semaine est spécifié, générer les créneaux pour ce jour
                return $this->getScheduleForDay($userId, $dayOfWeek);
            } else {
                // Sinon, retourner les horaires hebdomadaires
                return $this->getWeeklySchedule($userId);
            }

        } catch (\Exception $e) {
            Log::error('Erreur dans ScheduleController@index: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur serveur',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Générer les créneaux horaires pour une date spécifique
     */
    private function getScheduleForDate($userId, $date)
    {
        try {
            // Convertir la date et obtenir le jour de la semaine
            $carbonDate = Carbon::parse($date);
            $dayOfWeek = $this->getDayOfWeekInFrench($carbonDate->dayOfWeek);

            Log::info('Recherche horaire pour date', [
                'user_id' => $userId,
                'date' => $date,
                'day_of_week' => $dayOfWeek
            ]);

            return $this->getScheduleForDay($userId, $dayOfWeek, $date);

        } catch (\Exception $e) {
            Log::error('Erreur dans getScheduleForDate: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Générer les créneaux horaires pour un jour spécifique
     */
    private function getScheduleForDay($userId, $dayOfWeek, $date = null)
    {
        try {
            Log::info('Recherche horaire pour jour', [
                'user_id' => $userId,
                'day_of_week' => $dayOfWeek,
                'date' => $date
            ]);

            // Récupérer l'horaire hebdomadaire pour ce jour
            $weeklySchedule = Schedule::where('user_id', $userId)
                ->where('day_of_week', $dayOfWeek)
                ->first();

            if (!$weeklySchedule) {
                Log::info('Aucun horaire trouvé pour ce jour');
                return response()->json([]);
            }

            if (!$weeklySchedule->is_available) {
                Log::info('Médecin non disponible ce jour');
                return response()->json([]);
            }

            // Générer les créneaux de 30 minutes (excluant les pauses)
            $schedules = $this->generateTimeSlots(
                $weeklySchedule->start_time,
                $weeklySchedule->end_time,
                $weeklySchedule->break_start,
                $weeklySchedule->end_break,
                $userId,
                $date ?: $dayOfWeek
            );

            Log::info('Créneaux générés', ['count' => count($schedules)]);

            return response()->json([
                'doctor_id' => (int) $userId,
                'day_of_week' => $dayOfWeek,
                'date' => $date,
                'is_available' => true,
                'total_slots' => count($schedules),
                'work_hours' => [
                    'start' => $weeklySchedule->start_time,
                    'end' => $weeklySchedule->end_time,
                    'break_start' => $weeklySchedule->break_start,
                    'break_end' => $weeklySchedule->end_break
                ],
                'available_slots' => $schedules
            ]);

        } catch (\Exception $e) {
            Log::error('Erreur dans getScheduleForDay: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Récupérer les horaires hebdomadaires
     */
    private function getWeeklySchedule($userId)
    {
        $schedules = Schedule::where('user_id', $userId)
            ->get(['id', 'user_id', 'day_of_week', 'is_available', 'start_time', 'end_time', 'break_start', 'end_break']);

        return response()->json($schedules);
    }

    /**
     * Générer les créneaux horaires disponibles (excluant les pauses)
     */
    private function generateTimeSlots($startTime, $endTime, $breakStart, $breakEnd, $userId, $dateOrDay)
    {
        $slots = [];

        if (!$startTime || !$endTime) {
            Log::warning('Heures de début ou de fin manquantes');
            return $slots;
        }

        $current = Carbon::parse($startTime);
        $end = Carbon::parse($endTime);

        // Gérer les pauses (peuvent être nulles)
        $breakStartTime = $breakStart ? Carbon::parse($breakStart) : null;
        $breakEndTime = $breakEnd ? Carbon::parse($breakEnd) : null;

        while ($current->lt($end)) {
            $slotEnd = $current->copy()->addMinutes(30);

            // Vérifier si le créneau est pendant la pause
            $isBreak = false;
            if ($breakStartTime && $breakEndTime) {
                $isBreak = $current->gte($breakStartTime) && $current->lt($breakEndTime);
            }

            // N'ajouter que les créneaux qui ne sont PAS en pause
            if (!$isBreak) {
                $slots[] = [
                    'id' => null,
                    'user_id' => (int) $userId,
                    'date' => is_string($dateOrDay) && strlen($dateOrDay) > 10 ? $dateOrDay : null,
                    'day_of_week' => is_string($dateOrDay) && strlen($dateOrDay) <= 10 ? $dateOrDay : null,
                    'start_time' => $current->format('H:i'),
                    'end_time' => $slotEnd->format('H:i'),
                    'is_available' => true,
                    'status' => 'available'
                ];
            }

            $current->addMinutes(30);
        }

        return $slots;
    }

    /**
     * Obtenir les créneaux disponibles avec plus de détails
     */
    public function getAvailableSlots(Request $request)
    {
        try {
            $userId = $request->query('user_id');
            $date = $request->query('date');
            $dayOfWeek = $request->query('day_of_week');

            if (!$userId) {
                return response()->json(['error' => 'user_id is required'], 400);
            }

            if (!$date && !$dayOfWeek) {
                return response()->json(['error' => 'date or day_of_week is required'], 400);
            }

            $targetDay = $dayOfWeek;
            if ($date) {
                $carbonDate = Carbon::parse($date);
                $targetDay = $this->getDayOfWeekInFrench($carbonDate->dayOfWeek);
            }

            // Récupérer l'horaire du médecin
            $schedule = Schedule::where('user_id', $userId)
                ->where('day_of_week', $targetDay)
                ->first();

            if (!$schedule || !$schedule->is_available) {
                return response()->json([
                    'doctor_id' => (int) $userId,
                    'day_of_week' => $targetDay,
                    'date' => $date,
                    'is_available' => false,
                    'message' => 'Médecin non disponible ce jour'
                ]);
            }

            // Générer uniquement les créneaux disponibles (hors pause)
            $availableSlots = $this->generateAvailableSlots($schedule, $userId, $date);

            return response()->json([
                'doctor_id' => (int) $userId,
                'day_of_week' => $targetDay,
                'date' => $date,
                'is_available' => true,
                'work_schedule' => [
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'break_start' => $schedule->break_start,
                    'break_end' => $schedule->end_break
                ],
                'total_available_slots' => count($availableSlots),
                'available_slots' => $availableSlots
            ]);

        } catch (\Exception $e) {
            Log::error('Erreur dans getAvailableSlots: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur serveur',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Générer uniquement les créneaux disponibles
     */
    private function generateAvailableSlots($schedule, $userId, $date = null)
    {
        $slots = [];

        $current = Carbon::parse($schedule->start_time);
        $end = Carbon::parse($schedule->end_time);

        $breakStart = $schedule->break_start ? Carbon::parse($schedule->break_start) : null;
        $breakEnd = $schedule->end_break ? Carbon::parse($schedule->end_break) : null;

        while ($current->lt($end)) {
            $slotEnd = $current->copy()->addMinutes(30);

            // Vérifier si c'est pendant la pause
            $isDuringBreak = false;
            if ($breakStart && $breakEnd) {
                $isDuringBreak = $current->gte($breakStart) && $current->lt($breakEnd);
            }

            // Ajouter seulement si ce n'est pas pendant la pause
            if (!$isDuringBreak) {
                $slots[] = [
                    'slot_id' => uniqid(),
                    'doctor_id' => (int) $userId,
                    'date' => $date,
                    'start_time' => $current->format('H:i'),
                    'end_time' => $slotEnd->format('H:i'),
                    'duration_minutes' => 30,
                    'is_available' => true,
                    'status' => 'free'
                ];
            }

            $current->addMinutes(30);
        }

        return $slots;
    }

    /**
     * Convertir le numéro du jour en nom français
     */
    private function getDayOfWeekInFrench($dayOfWeek)
    {
        $days = [
            0 => 'Dimanche',
            1 => 'Lundi',
            2 => 'Mardi',
            3 => 'Mercredi',
            4 => 'Jeudi',
            5 => 'Vendredi',
            6 => 'Samedi'
        ];

        return $days[$dayOfWeek];
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'user_id' => 'required|exists:users,id',
                'day_of_week' => 'required|in:Lundi,Mardi,Mercredi,Jeudi,Vendredi,Samedi,Dimanche',
                'is_available' => 'required|boolean',
                'start_time' => 'nullable|date_format:H:i',
                'end_time' => 'nullable|date_format:H:i|after:start_time',
                'break_start' => 'nullable|date_format:H:i',
                'end_break' => 'nullable|date_format:H:i|after:break_start',
            ]);

            $schedule = Schedule::create($validated);
            return response()->json([
                'success' => true,
                'data' => $schedule
            ], 201);

        } catch (\Exception $e) {
            Log::error('Erreur dans ScheduleController@store: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur lors de la création',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        try {
            $schedule = Schedule::with('user')->findOrFail($id);
            return response()->json($schedule);
        } catch (\Exception $e) {
            Log::error('Erreur dans ScheduleController@show: ' . $e->getMessage());
            return response()->json([
                'error' => 'Horaire non trouvé',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        try {
            $schedule = Schedule::findOrFail($id);

            $data = $request->validate([
                'user_id' => 'required|exists:users,id',
                'day_of_week' => 'required|string',
                'is_available' => 'required|boolean',
                'start_time' => 'nullable|date_format:H:i',
                'end_time' => 'nullable|date_format:H:i|after:start_time',
                'break_start' => 'nullable|date_format:H:i',
                'end_break' => 'nullable|date_format:H:i|after:break_start',
            ]);

            $schedule->update($data);

            return response()->json(['success' => true, 'data' => $schedule], 200);

        } catch (\Exception $e) {
            Log::error('Erreur dans ScheduleController@update: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur lors de la mise à jour',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        try {
            $schedule = Schedule::findOrFail($id);
            $schedule->delete();
            return response()->json(null, 204);
        } catch (\Exception $e) {
            Log::error('Erreur dans ScheduleController@destroy: ' . $e->getMessage());
            return response()->json([
                'error' => 'Erreur lors de la suppression',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
