<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\RendezVous;
use App\Models\Medecin;
use App\Models\Patient;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Log; // Assurez-vous que ceci est bien importé
use App\Models\Schedule;
use Illuminate\Database\QueryException;

class RendezVousController extends Controller
{
    /**
     * Display a paginated list of appointments for the authenticated doctor.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $user = Auth::user();

        // MODIFICATION: Ajout de la relation 'paiement' pour charger les informations de paiement
        $query = RendezVous::with(['patient.user', 'medecin.user', 'paiement']);

        if ($user->role === 'patient') {
            $patient = $user->patient;
            if ($patient) {
                $query->where('patient_id', $patient->id);
            } else {
                return response()->json(['data' => [], 'message' => 'No patient profile found.'], 200);
            }
        }
        // Si c'est un médecin, filtrer par ses rendez-vous
        elseif ($user->role === 'medecin') {
            $medecin = $user->medecin;
            if ($medecin) {
                $query->where('medecin_id', $medecin->id);
            } else {
                return response()->json(['data' => [], 'message' => 'No doctor profile found.'], 200);
            }
        }

        // Trier par date/heure
        $query->orderBy('date_heure', 'asc');

        return response()->json($query->paginate(10));
    }


    /**
     * Store a new appointment in the database.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        \Log::info('Data received for appointment creation:', $request->all());
        $validator = Validator::make($request->all(), [
            'patient_id' => 'required|exists:patients,id',
            'medecin_id' => 'required|exists:medecins,id',
            'date_heure' => 'required|date|after_or_equal:now',
            'motif' => 'required|string|max:255',
            'statut' => ['sometimes', 'string', Rule::in(['en_attente', 'confirme', 'annule', 'termine'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $medecin = Medecin::find($request->medecin_id);

        if (!$medecin) {
            return response()->json([
                'message' => 'Doctor not found'
            ], 404);
        }

        if (!$this->verifierDisponibilite($medecin, $request->date_heure)) {
            return response()->json([
                'message' => 'Doctor not available at this time',
                'error_code' => 'DOCTOR_UNAVAILABLE'
            ], 400);
        }

        try {
            $rendezVous = RendezVous::create([
                'patient_id' => $request->patient_id,
                'medecin_id' => $request->medecin_id,
                'date_heure' => $request->date_heure,
                'motif' => $request->motif,
                'tarif' => $medecin->tarif_consultation,
                'statut' => $request->input('statut', 'en_attente'),
            ]);

            return response()->json([
                'message' => 'Appointment created successfully',
                'data' => $rendezVous->load(['patient.user', 'medecin.user'])
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating appointment: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'exception' => $e
            ]);
            return response()->json([
                'message' => 'Error creating appointment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check doctor availability for a given slot.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkAvailability(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'medecin_id' => 'required|exists:medecins,id',
            'date_heure' => 'required|date|after_or_equal:now',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $medecin = Medecin::find($request->medecin_id);

            if (!$medecin) {
                return response()->json([
                    'message' => 'Doctor not found'
                ], 404);
            }

            $disponible = $this->verifierDisponibilite($medecin, $request->date_heure);

            $date = Carbon::parse($request->date_heure);
            $jour = strtolower($date->format('l'));
            $heure = $date->format('H:i');

            $horairesMedecin = $medecin->horaire_consultation[$jour] ?? null;

            $rendezVousExistant = RendezVous::where('medecin_id', $medecin->id)
                ->where('date_heure', $request->date_heure)
                ->where('statut', 'confirme')
                ->exists();

            return response()->json([
                'available' => $disponible,
                'medecin_id' => $request->medecin_id,
                'date_heure' => $request->date_heure,
                'jour' => $jour,
                'heure' => $heure,
                'horaires_medecin' => $horairesMedecin,
                'rendez_vous_existant' => $rendezVousExistant,
                'message' => $disponible ? 'Slot available' : 'Slot not available',
                'details' => $this->getAvailabilityDetails($medecin, $request->date_heure)
            ]);

        } catch (\Exception $e) {
            \Log::error('Error checking availability: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'exception' => $e
            ]);
            return response()->json([
                'message' => 'Error checking availability',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get availability details for debugging.
     *
     * @param  \App\Models\Medecin  $medecin
     * @param  string  $dateHeure
     * @return array
     */
    private function getAvailabilityDetails($medecin, $dateHeure)
    {
        $date = Carbon::parse($dateHeure);
        $jour = strtolower($date->format('l'));
        $heure = $date->format('H:i');

        $details = [
            'requested_day' => $jour,
            'requested_time' => $heure,
            'doctor_schedule' => $medecin->horaire_consultation,
            'day_available_in_schedule' => isset($medecin->horaire_consultation[$jour]),
        ];

        if (isset($medecin->horaire_consultation[$jour])) {
            $horaires = $medecin->horaire_consultation[$jour];
            $details['schedule_start_time'] = $horaires['debut'];
            $details['schedule_end_time'] = $horaires['fin'];
            $details['within_schedule_hours'] = ($heure >= $horaires['debut'] && $heure <= $horaires['fin']);
        }

        $existingAppointmentsCount = RendezVous::where('medecin_id', $medecin->id)
            ->where('date_heure', $dateHeure)
            ->where('statut', 'confirme')
            ->count();

        $details['existing_appointments_count'] = $existingAppointmentsCount;

        return $details;
    }

    /**
     * Check if a doctor is available for a given slot.
     *
     * @param  \App\Models\Medecin  $medecin
     * @param  string  $dateHeure
     * @param  int|null $excludeAppointmentId ID of the appointment to exclude from checking (for modification/reschedule)
     * @return bool
     */
    protected function verifierDisponibilite(Medecin $medecin, $dateHeure, $excludeAppointmentId = null): bool
    {
        \Log::info("Starting availability check for Doctor ID: {$medecin->id} (User ID: {$medecin->user_id}) at {$dateHeure}");

        $requestedDateTime = Carbon::parse($dateHeure);
        $requestedDate = $requestedDateTime->toDateString();
        $requestedTime = $requestedDateTime->format('H:i:s');

        $dayOfWeekMap = [
            1 => 'Lundi', 2 => 'Mardi', 3 => 'Mercredi', 4 => 'Jeudi',
            5 => 'Vendredi', 6 => 'Samedi', 7 => 'Dimanche',
        ];
        $requestedDayOfWeekString = $dayOfWeekMap[$requestedDateTime->dayOfWeekIso] ?? null;

        if (!$requestedDayOfWeekString) {
            \Log::warning("Doctor unavailable: Invalid day of week for the requested date.");
            return false;
        }

        $schedulesForDay = \App\Models\Schedule::where('user_id', $medecin->user_id)
            ->where('day_of_week', $requestedDayOfWeekString)
            ->get();

        \Log::info("Schedules found for {$requestedDayOfWeekString}: " . $schedulesForDay->toJson());

        if ($schedulesForDay->isEmpty()) {
            \Log::warning("Doctor unavailable: No schedule configured for {$requestedDayOfWeekString}.");
            return false;
        }

        $isWithinWorkingHours = false;
        $isDuringBreak = false;

        foreach ($schedulesForDay as $schedule) {
            if (!$schedule->is_available) {
                continue;
            }

            if ($schedule->start_time && $schedule->end_time) {
                $scheduleStart = Carbon::parse($requestedDate . ' ' . $schedule->start_time);
                $scheduleEnd = Carbon::parse($requestedDate . ' ' . $schedule->end_time);

                if ($requestedDateTime->between($scheduleStart, $scheduleEnd, true)) {
                    $isWithinWorkingHours = true;
                    if ($schedule->break_start && $schedule->end_break) {
                        $breakStart = Carbon::parse($requestedDate . ' ' . $schedule->break_start);
                        $breakEnd = Carbon::parse($requestedDate . ' ' . $schedule->end_break);

                        if ($requestedDateTime->between($breakStart, $breakEnd, false)) {
                            $isDuringBreak = true;
                            break;
                        }
                    }
                }
            }
        }

        if (!$isWithinWorkingHours) {
            \Log::warning("Doctor unavailable: The requested time is not within defined working hours.");
            return false;
        }

        if ($isDuringBreak) {
            \Log::warning("Doctor unavailable: The requested time falls during a break.");
            return false;
        }

        $existingAppointmentQuery = RendezVous::where('medecin_id', $medecin->id)
            ->where('date_heure', $requestedDateTime)
            ->whereIn('statut', ['confirme', 'en_attente']);

        if ($excludeAppointmentId) {
            $existingAppointmentQuery->where('id', '!=', $excludeAppointmentId);
        }

        $existingAppointment = $existingAppointmentQuery->first();

        \Log::info("Existing appointment found: " . ($existingAppointment ? $existingAppointment->toJson() : 'None'));

        if ($existingAppointment) {
            \Log::warning("Doctor unavailable: Slot already taken by a confirmed or pending appointment.");
            return false;
        }

        \Log::info("Doctor available for this slot.");
        return true;
    }

    /**
     * Display the details of a specific appointment.
     *
     * @param  \App\Models\RendezVous  $rendezVous
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(RendezVous $rendezVous)
    {
        return response()->json($rendezVous->load(['patient.user', 'medecin.user']));
    }

    /**
     * Update an existing appointment.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\RendezVous  $rendezVous
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        \Log::info('Début de la méthode update avec ID: ' . $id, [
            'donnees_requete' => $request->all()
        ]);

        // Chargement manuel du rendez-vous
        $rendezVous = RendezVous::find($id);

        if (!$rendezVous) {
            \Log::error('Rendez-vous non trouvé dans la base de données', [
                'id_demande' => $id,
                'ids_existants' => RendezVous::pluck('id')->toArray()
            ]);
            return response()->json(['message' => 'Rendez-vous non trouvé.'], 404);
        }

        \Log::info('Rendez-vous trouvé pour mise à jour:', [
            'id' => $rendezVous->id,
            'existe' => $rendezVous->exists,
            'attributs' => $rendezVous->toArray()
        ]);

        $validator = Validator::make($request->all(), [
            'date_heure' => 'sometimes|date|after_or_equal:now',
            'motif' => 'sometimes|string',
            'statut' => ['sometimes', 'string', Rule::in(['en_attente', 'confirme', 'annule', 'termine'])],
            'medecin_id' => 'sometimes|exists:medecins,id',
            'patient_id' => 'sometimes|exists:patients,id',
            'tarif' => 'sometimes|numeric|min:0',
        ]);

        if ($validator->fails()) {
            \Log::error('Erreur de validation lors de la mise à jour du rendez-vous:', $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Vérification de la disponibilité du médecin
        $targetMedecinId = $request->has('medecin_id') ? $request->medecin_id : $rendezVous->medecin_id;
        $medecin = Medecin::find($targetMedecinId);

        if (!$medecin) {
            \Log::error('Erreur: Médecin spécifié non trouvé lors de la mise à jour du rendez-vous.', [
                'rendez_vous_id' => $rendezVous->id,
                'target_medecin_id' => $targetMedecinId
            ]);
            return response()->json(['message' => 'Médecin associé non trouvé.'], 404);
        }

        // Vérifier la disponibilité si la date ou le médecin change
        if ($request->has('date_heure') || $request->has('medecin_id')) {
            $nouvelleDateHeure = $request->has('date_heure') ? $request->date_heure : $rendezVous->date_heure;

            if (!$this->verifierDisponibilite($medecin, $nouvelleDateHeure, $rendezVous->id)) {
                return response()->json([
                    'message' => 'Médecin non disponible selon l\'horaire ou créneau déjà pris à cette nouvelle heure.'
                ], 400);
            }
        }

        // Préparer les données de mise à jour (exclure le champ 'id')
        $donneesMAJ = $request->except(['id']);

        // Gérer la conversion du format de date si nécessaire
        if (isset($donneesMAJ['date_heure'])) {
            try {
                $donneesMAJ['date_heure'] = Carbon::parse($donneesMAJ['date_heure'])->format('Y-m-d H:i:s');
                \Log::info('Date convertie:', ['nouvelle_date' => $donneesMAJ['date_heure']]);
            } catch (\Exception $e) {
                \Log::error('Format de date invalide dans la requête de mise à jour', [
                    'date_heure' => $donneesMAJ['date_heure'],
                    'erreur' => $e->getMessage()
                ]);
                return response()->json(['message' => 'Format de date fourni invalide.'], 422);
            }
        }

        // Journaliser les données avant la mise à jour
        \Log::info('Données avant mise à jour:', [
            'original' => $rendezVous->getOriginal(),
            'actuel' => $rendezVous->getAttributes(),
            'donnees_maj' => $donneesMAJ
        ]);

        // Vérifier s'il y a des changements réels nécessaires
        $aDesChangements = false;
        foreach ($donneesMAJ as $cle => $valeur) {
            if ($rendezVous->getAttribute($cle) != $valeur) {
                $aDesChangements = true;
                \Log::info("Changement détecté pour {$cle}: '{$rendezVous->getAttribute($cle)}' -> '{$valeur}'");
                break;
            }
        }

        if (!$aDesChangements) {
            \Log::info('Aucun changement détecté, retour du modèle actuel');
            return response()->json([
                'message' => 'Rendez-vous mis à jour avec succès (aucun changement n\'était nécessaire).',
                'data' => $rendezVous->load(['patient.user', 'medecin.user'])
            ], 200);
        }

        // Effectuer la mise à jour
        try {
            // Actualiser le modèle depuis la base de données d'abord
            $rendezVous = $rendezVous->fresh();

            if (!$rendezVous) {
                \Log::error('Le modèle a disparu pendant le processus de mise à jour');
                return response()->json(['message' => 'Le rendez-vous n\'existe plus.'], 404);
            }

            // Utiliser fill et save pour un meilleur débogage
            $rendezVous->fill($donneesMAJ);

            \Log::info('Modèle après fill:', [
                'attributs_modifies' => $rendezVous->getDirty(),
                'tous_attributs' => $rendezVous->getAttributes()
            ]);

            $resultatSauvegarde = $rendezVous->save();

            \Log::info('Résultat de l\'opération de sauvegarde:', [
                'succes' => $resultatSauvegarde,
                'modele_apres_sauvegarde' => $rendezVous->fresh()->toArray()
            ]);

            if (!$resultatSauvegarde) {
                \Log::error('L\'opération de sauvegarde a retourné false', [
                    'rendez_vous_id' => $rendezVous->id,
                    'donnees_maj' => $donneesMAJ
                ]);
                return response()->json(['message' => 'Échec de la mise à jour du rendez-vous.'], 500);
            }

            return response()->json([
                'message' => 'Rendez-vous mis à jour avec succès.',
                'data' => $rendezVous->fresh()->load(['patient.user', 'medecin.user'])
            ], 200);

        } catch (QueryException $e) {
            \Log::error('Erreur de base de données lors de la mise à jour du rendez-vous:', [
                'rendez_vous_id' => $rendezVous->id,
                'code_erreur' => $e->getCode(),
                'message_erreur' => $e->getMessage(),
                'sql_state' => $e->getSql() ?? 'N/A',
                'donnees_maj' => $donneesMAJ
            ]);

            return response()->json([
                'message' => 'Erreur de base de données lors de la mise à jour du rendez-vous.',
                'error' => $e->getMessage()
            ], 500);

        } catch (\Exception $e) {
            \Log::error('Erreur inattendue lors de la mise à jour du rendez-vous:', [
                'rendez_vous_id' => $rendezVous->id,
                'message_erreur' => $e->getMessage(),
                'donnees_maj' => $donneesMAJ,
                'trace_pile' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Erreur interne du serveur lors de la mise à jour du rendez-vous.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    /**
     * Update the status of a specific appointment.
     * This method is added to handle status changes (e.g., cancellation) via a dedicated PATCH route.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\RendezVous  $rendezVous
     * @return \Illuminate\Http\JsonResponse
     */

    public function updateStatut(Request $request, RendezVous $rendezVous)
    {
        Log::info('RendezVousController@updateStatut: Début de la méthode pour le RDV ID: ' . $rendezVous->id, ['request_data' => $request->all()]);

        $validator = Validator::make($request->all(), [
            'statut' => ['required', 'string', Rule::in(['en_attente', 'confirme', 'annule', 'termine'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            Log::error('RendezVousController@updateStatut: Erreur de validation', ['errors' => $validator->errors()]);
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $oldStatus = $rendezVous->statut;
            $newStatus = $request->statut;
            $reason = $request->input('reason');

            Log::info('RendezVousController@updateStatut: Tentative de mise à jour du statut', [
                'rendez_vous_id' => $rendezVous->id,
                'ancien_statut' => $oldStatus,
                'nouveau_statut' => $newStatus,
                'raison' => $reason
            ]);

            // Mettre à jour le statut et la raison d'annulation
            // IMPORTANT: Ne PAS appeler $rendezVous->delete() ici pour l'annulation
            $rendezVous->update([
                'statut' => $newStatus,
                'reason' => $reason
            ]);

            Log::info('RendezVousController@updateStatut: Statut du rendez-vous mis à jour avec succès.', [
                'rendez_vous_id' => $rendezVous->id,
                'new_status' => $newStatus,
                'reason' => $reason,
                'rendezVous_after_update' => $rendezVous->fresh()->toArray() // Recharger pour voir l'état actuel
            ]);

            return response()->json([
                'message' => 'Appointment status updated successfully',
                'data' => $rendezVous->load(['patient.user', 'medecin.user'])
            ], 200);

        } catch (\Exception $e) {
            Log::error('RendezVousController@updateStatut: Erreur inattendue lors de la mise à jour du statut: ' . $e->getMessage(), [
                'appointment_id' => $rendezVous->id,
                'request_data' => $request->all(),
                'exception' => $e
            ]);
            return response()->json([
                'message' => 'Error updating appointment status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reschedule an appointment to a new date/time.
     *
     * @param Request $request
     * @param RendezVous $rendezVous
     * @return \Illuminate\Http\JsonResponse
     */
    public function reschedule(Request $request, RendezVous $rendezVous)
    {
        \Log::info('Attempting to reschedule appointment ' . $rendezVous->id . ':', $request->all());

        // Validation pour tous les champs attendus du frontend
        $validator = Validator::make($request->all(), [
            'new_date_heure' => ['required', 'date_format:Y-m-d H:i:s', 'after_or_equal:now'],
            'reschedule_reason' => ['required', 'string', 'max:500'],
            'patient_id' => ['required', 'exists:patients,id'], // Ajout de la validation
            'medecin_id' => ['required', 'exists:medecins,id'], // Ajout de la validation
            'motif' => ['required', 'string', 'max:255'],       // Ajout de la validation
            'tarif' => ['required', 'numeric', 'min:0'],        // Ajout de la validation
        ]);

        if ($validator->fails()) {
            \Log::error('Validation error during reschedule:', $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $newDateTime = Carbon::parse($request->new_date_heure);

            $targetMedecinId = $request->medecin_id; // Utilisation directe du medecin_id du request
            $medecin = Medecin::find($targetMedecinId);

            if (!$medecin) {
                \Log::error('Error: Specified doctor (ID: ' . $targetMedecinId . ') not found during appointment reschedule.', [
                    'rendez_vous_id' => $rendezVous->id,
                    'target_medecin_id' => $targetMedecinId
                ]);
                return response()->json(['message' => 'Associated doctor not found for rescheduling.'], 404);
            }

            // Vérifier la disponibilité pour le nouveau créneau, en excluant le rendez-vous actuel
            if (!$this->verifierDisponibilite($medecin, $newDateTime->toDateTimeString(), $rendezVous->id)) {
                return response()->json([
                    'message' => 'Doctor not available at this new slot (schedule or already taken).',
                    'error_code' => 'SLOT_UNAVAILABLE',
                ], 409);
            }

            // Sauvegarder l'ancienne date/heure si nécessaire (pour l'historique ou le suivi)
            $rendezVous->old_date_heure = $rendezVous->date_heure;

            // Mettre à jour tous les champs pertinents du rendez-vous
            $rendezVous->update([
                'date_heure' => $newDateTime,
                'reschedule_reason' => $request->reschedule_reason,
                'patient_id' => $request->patient_id, // Mise à jour du patient_id
                'medecin_id' => $request->medecin_id, // Mise à jour du medecin_id
                'motif' => $request->motif,           // Mise à jour du motif
                'tarif' => $request->tarif,           // Mise à jour du tarif
                'statut' => 'en_attente',             // Réinitialiser le statut à 'en_attente' après report
            ]);

            return response()->json([
                'message' => 'Appointment rescheduled successfully',
                'data' => $rendezVous->load(['patient.user', 'medecin.user'])
            ], 200);

        } catch (\Exception | \Throwable $e) {
            Log::error('Error rescheduling appointment: ' . $e->getMessage(), [
                'appointment_id' => $rendezVous->id,
                'request_data' => $request->all(),
                'exception' => $e
            ]);
            return response()->json([
                'message' => 'Error rescheduling appointment',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
