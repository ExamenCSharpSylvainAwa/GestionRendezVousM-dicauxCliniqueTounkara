<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Prescription;
use App\Models\Medicament;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class PrescriptionController extends Controller
{
    public function index()
    {
        try {
            $prescriptions = Prescription::with('consultation.dossierMedical.patient.user', 'medicaments')->paginate(10);
            return response()->json($prescriptions);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération des prescriptions : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            // Log des données reçues pour debug
            Log::info('Données reçues pour création prescription:', $request->all());

            $validator = Validator::make($request->all(), [
                'consultation_id' => 'required|integer|exists:consultations,id',
                'date_emission' => 'required|date',
                'date_expiration' => 'required|date|after:date_emission',
                'description' => 'required|string|max:1000',
                'medicaments' => 'required|array|min:1',
                'medicaments.*.nom' => 'required|string|max:255',
                'medicaments.*.posologie' => 'required|string|max:255',
                'medicaments.*.duree' => 'required|string|max:255',
                'medicaments.*.instructions' => 'nullable|string|max:1000',
            ], [
                'consultation_id.required' => 'La consultation est requise.',
                'consultation_id.integer' => 'L\'ID de consultation doit être un nombre entier.',
                'consultation_id.exists' => 'La consultation spécifiée n\'existe pas.',
                'date_emission.required' => 'La date d\'émission est requise.',
                'date_emission.date' => 'La date d\'émission doit être une date valide.',
                'date_expiration.required' => 'La date d\'expiration est requise.',
                'date_expiration.date' => 'La date d\'expiration doit être une date valide.',
                'date_expiration.after' => 'La date d\'expiration doit être postérieure à la date d\'émission.',
                'description.required' => 'La description est requise.',
                'description.max' => 'La description ne peut pas dépasser 1000 caractères.',
                'medicaments.required' => 'Au moins un médicament est requis.',
                'medicaments.array' => 'Les médicaments doivent être un tableau.',
                'medicaments.min' => 'Au moins un médicament est requis.',
                'medicaments.*.nom.required' => 'Le nom du médicament est requis.',
                'medicaments.*.nom.max' => 'Le nom du médicament ne peut pas dépasser 255 caractères.',
                'medicaments.*.posologie.required' => 'La posologie du médicament est requise.',
                'medicaments.*.posologie.max' => 'La posologie ne peut pas dépasser 255 caractères.',
                'medicaments.*.duree.required' => 'La durée du médicament est requise.',
                'medicaments.*.duree.max' => 'La durée ne peut pas dépasser 255 caractères.',
                'medicaments.*.instructions.max' => 'Les instructions ne peuvent pas dépasser 1000 caractères.',
            ]);

            if ($validator->fails()) {
                Log::warning('Erreurs de validation:', $validator->errors()->toArray());
                return response()->json(['errors' => $validator->errors()], 422);
            }

            // Utilisation d'une transaction pour assurer la cohérence
            DB::beginTransaction();

            try {
                $prescription = Prescription::create([
                    'consultation_id' => $request->consultation_id,
                    'date_emission' => $request->date_emission,
                    'date_expiration' => $request->date_expiration,
                    'description' => trim($request->description),
                ]);

                // Création des médicaments
                foreach ($request->medicaments as $medicamentData) {
                    Medicament::create([
                        'prescription_id' => $prescription->id,
                        'nom' => trim($medicamentData['nom']),
                        'posologie' => trim($medicamentData['posologie']),
                        'duree' => trim($medicamentData['duree']),
                        'instructions' => isset($medicamentData['instructions']) ? trim($medicamentData['instructions']) : null,
                    ]);
                }

                DB::commit();

                // Récupération de la prescription avec toutes les relations
                $prescriptionWithRelations = Prescription::with('consultation.dossierMedical.patient.user', 'medicaments')
                    ->find($prescription->id);

                Log::info('Prescription créée avec succès:', ['id' => $prescription->id]);

                return response()->json($prescriptionWithRelations, 201);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Erreur lors de la création de la prescription : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'error' => 'Erreur interne du serveur',
                'message' => config('app.debug') ? $e->getMessage() : 'Une erreur s\'est produite lors de la création de la prescription'
            ], 500);
        }
    }

    public function show(Prescription $prescription)
    {
        try {
            return response()->json($prescription->load('consultation.dossierMedical.patient.user', 'medicaments'));
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération de la prescription : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, Prescription $prescription)
    {
        try {
            // Log des données reçues pour debug
            Log::info('Données reçues pour mise à jour prescription:', ['id' => $prescription->id, 'data' => $request->all()]);

            $validator = Validator::make($request->all(), [
                'consultation_id' => 'sometimes|required|integer|exists:consultations,id',
                'date_emission' => 'sometimes|required|date',
                'date_expiration' => 'sometimes|required|date|after:date_emission',
                'description' => 'sometimes|required|string|max:1000',
                'medicaments' => 'sometimes|required|array|min:1',
                'medicaments.*.nom' => 'required|string|max:255',
                'medicaments.*.posologie' => 'required|string|max:255',
                'medicaments.*.duree' => 'required|string|max:255',
                'medicaments.*.instructions' => 'nullable|string|max:1000',
            ], [
                'consultation_id.required' => 'La consultation est requise.',
                'consultation_id.integer' => 'L\'ID de consultation doit être un nombre entier.',
                'consultation_id.exists' => 'La consultation spécifiée n\'existe pas.',
                'date_emission.required' => 'La date d\'émission est requise.',
                'date_emission.date' => 'La date d\'émission doit être une date valide.',
                'date_expiration.required' => 'La date d\'expiration est requise.',
                'date_expiration.date' => 'La date d\'expiration doit être une date valide.',
                'date_expiration.after' => 'La date d\'expiration doit être postérieure à la date d\'émission.',
                'description.required' => 'La description est requise.',
                'description.max' => 'La description ne peut pas dépasser 1000 caractères.',
                'medicaments.required' => 'Au moins un médicament est requis.',
                'medicaments.array' => 'Les médicaments doivent être un tableau.',
                'medicaments.min' => 'Au moins un médicament est requis.',
                'medicaments.*.nom.required' => 'Le nom du médicament est requis.',
                'medicaments.*.nom.max' => 'Le nom du médicament ne peut pas dépasser 255 caractères.',
                'medicaments.*.posologie.required' => 'La posologie du médicament est requise.',
                'medicaments.*.posologie.max' => 'La posologie ne peut pas dépasser 255 caractères.',
                'medicaments.*.duree.required' => 'La durée du médicament est requise.',
                'medicaments.*.duree.max' => 'La durée ne peut pas dépasser 255 caractères.',
                'medicaments.*.instructions.max' => 'Les instructions ne peuvent pas dépasser 1000 caractères.',
            ]);

            if ($validator->fails()) {
                Log::warning('Erreurs de validation (mise à jour):', $validator->errors()->toArray());
                return response()->json(['errors' => $validator->errors()], 422);
            }

            // Utilisation d'une transaction pour assurer la cohérence
            DB::beginTransaction();

            try {
                // Mise à jour des données de base de la prescription
                $updateData = [];
                if ($request->has('consultation_id')) {
                    $updateData['consultation_id'] = $request->consultation_id;
                }
                if ($request->has('date_emission')) {
                    $updateData['date_emission'] = $request->date_emission;
                }
                if ($request->has('date_expiration')) {
                    $updateData['date_expiration'] = $request->date_expiration;
                }
                if ($request->has('description')) {
                    $updateData['description'] = trim($request->description);
                }

                if (!empty($updateData)) {
                    $prescription->update($updateData);
                }

                // Mise à jour des médicaments si fournis
                if ($request->has('medicaments')) {
                    // Supprimer les anciens médicaments
                    $prescription->medicaments()->delete();

                    // Créer les nouveaux médicaments
                    foreach ($request->medicaments as $medicamentData) {
                        Medicament::create([
                            'prescription_id' => $prescription->id,
                            'nom' => trim($medicamentData['nom']),
                            'posologie' => trim($medicamentData['posologie']),
                            'duree' => trim($medicamentData['duree']),
                            'instructions' => isset($medicamentData['instructions']) ? trim($medicamentData['instructions']) : null,
                        ]);
                    }
                }

                DB::commit();

                // Récupération de la prescription mise à jour avec toutes les relations
                $prescriptionWithRelations = Prescription::with('consultation.dossierMedical.patient.user', 'medicaments')
                    ->find($prescription->id);

                Log::info('Prescription mise à jour avec succès:', ['id' => $prescription->id]);

                return response()->json($prescriptionWithRelations);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Erreur lors de la mise à jour de la prescription : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'prescription_id' => $prescription->id,
                'request_data' => $request->all()
            ]);
            return response()->json([
                'error' => 'Erreur interne du serveur',
                'message' => config('app.debug') ? $e->getMessage() : 'Une erreur s\'est produite lors de la mise à jour de la prescription'
            ]);
        }
    }

    public function destroy(Prescription $prescription)
    {
        try {
            DB::beginTransaction();

            // Supprimer les médicaments associés
            $prescription->medicaments()->delete();

            // Supprimer la prescription
            $prescription->delete();

            DB::commit();

            Log::info('Prescription supprimée avec succès:', ['id' => $prescription->id]);

            return response()->json(['message' => 'Prescription supprimée avec succès'], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erreur lors de la suppression de la prescription : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'prescription_id' => $prescription->id
            ]);
            return response()->json([
                'error' => 'Erreur interne du serveur',
                'message' => config('app.debug') ? $e->getMessage() : 'Une erreur s\'est produite lors de la suppression de la prescription'
            ], 500);
        }
    }
}
