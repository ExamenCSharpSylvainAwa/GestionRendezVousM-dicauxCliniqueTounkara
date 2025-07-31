<?php
namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\DossierMedical;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class DossierMedicalController extends Controller
{
    public function index()
    {
        try {
            $dossiers = DossierMedical::with(['patient.user', 'consultations.prescriptions'])->paginate(10);
            return response()->json($dossiers);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération des dossiers médicaux : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'patient_id' => 'required|exists:patients,id',
            ], [
                'patient_id.required' => 'L\'ID du patient est requis.',
                'patient_id.exists' => 'Le patient spécifié n\'existe pas.',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $dossier = DossierMedical::create($request->all());
            return response()->json($dossier->load(['patient.user']), 201);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la création du dossier médical : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function show(DossierMedical $dossierMedical)
    {
        try {
            return response()->json($dossierMedical->load(['patient.user', 'consultations.prescriptions']));
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération du dossier médical : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, DossierMedical $dossierMedical)
    {
        try {
            $validator = Validator::make($request->all(), [
                'patient_id' => 'sometimes|required|exists:patients,id',
            ], [
                'patient_id.required' => 'L\'ID du patient est requis.',
                'patient_id.exists' => 'Le patient spécifié n\'existe pas.',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $dossierMedical->update($request->all());
            return response()->json($dossierMedical->load(['patient.user']));
        } catch (\Exception $e) {
            Log::error('Erreur lors de la mise à jour du dossier médical : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(DossierMedical $dossierMedical)
    {
        try {
            $dossierMedical->delete();
            return response()->json(['message' => 'Dossier médical supprimé avec succès']);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la suppression du dossier médical : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['error' => 'Erreur interne du serveur', 'message' => $e->getMessage()], 500);
        }
    }

    public function showMyMedicalRecord()
    {
        try {
            // Vérifier que l'utilisateur authentifié a le rôle 'patient'
            $user = Auth::user();
            if (!$user || $user->role !== 'patient') {
                return response()->json([
                    'error' => 'Accès interdit',
                    'message' => 'Seuls les patients peuvent consulter leur dossier médical.'
                ], 403);
            }

            // Trouver le patient associé à l'utilisateur
            $patient = $user->patient;
            if (!$patient) {
                return response()->json([
                    'error' => 'Patient non trouvé',
                    'message' => 'Aucun patient associé à cet utilisateur.'
                ], 404);
            }

            // Récupérer le dossier médical du patient avec ses relations
            $dossierMedical = DossierMedical::where('patient_id', $patient->id)
                ->with([
                    'patient.user',
                    'consultations' => function ($query) {
                        $query->with('prescriptions');
                    }
                ])
                ->first();

            if (!$dossierMedical) {
                return response()->json([
                    'error' => 'Dossier médical non trouvé',
                    'message' => 'Aucun dossier médical trouvé pour ce patient.'
                ], 404);
            }

            // Formater la réponse JSON manuellement
            return response()->json([
                'id' => $dossierMedical->id,
                'patient_id' => $dossierMedical->patient_id,
                'date_creation' => $dossierMedical->date_creation,
                'created_at' => $dossierMedical->created_at,
                'updated_at' => $dossierMedical->updated_at,
                'patient' => [
                    'id' => $patient->id,
                    'user_id' => $patient->user_id,
                    'numero_assurance' => $patient->numero_assurance,
                    'adresse' => $patient->adresse,
                    'date_naissance' => $patient->date_naissance,
                    'sexe' => $patient->sexe,
                    'groupe_sanguin' => $patient->groupe_sanguin,
                    'antecedent_medicaux' => $patient->antecedent_medicaux,
                    'user' => [
                        'id' => $user->id,
                        'nom' => $user->nom,
                        'prenom' => $user->prenom,
                        'email' => $user->email,
                        'role' => $user->role,
                    ]
                ],
                'consultations' => $dossierMedical->consultations->map(function ($consultation) {
                    return [
                        'id' => $consultation->id,
                        'dossier_medical_id' => $consultation->dossier_medical_id,
                        'date' => $consultation->date,
                        'symptomes' => $consultation->symptomes,
                        'diagnostic' => $consultation->diagnostic,
                        'recommandations' => $consultation->recommandations,
                        'notes' => $consultation->notes,
                        'created_at' => $consultation->created_at,
                        'updated_at' => $consultation->updated_at,
                        'prescriptions' => $consultation->prescriptions->map(function ($prescription) {
                            return [
                                'id' => $prescription->id,
                                'consultation_id' => $prescription->consultation_id,
                                'date_emission' => $prescription->date_emission,
                                'date_expiration' => $prescription->date_expiration,
                                'description' => $prescription->description,
                                'medicaments' => $prescription->medicaments,
                                'created_at' => $prescription->created_at,
                                'updated_at' => $prescription->updated_at,
                            ];
                        })->toArray(),
                    ];
                })->toArray(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération du dossier médical : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'error' => 'Erreur interne du serveur',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
