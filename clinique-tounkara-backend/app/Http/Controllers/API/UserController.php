<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Patient;
use App\Models\Medecin;
use App\Models\Personnel;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index()
    {
        $users = User::with(['patient', 'medecin', 'personnel', 'administrateur'])->paginate(10);
        return response()->json($users);
    }

    public function store(Request $request)
    {
        // Log des données reçues pour débogage
        Log::info('UserController store - Données reçues:', $request->all());

        // Validation des données de base
        $baseRules = [
            'prenom' => 'required|string|max:255',
            'nom' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:patient,medecin,personnel,administrateur',
            'actif' => 'sometimes|boolean',
            'telephone' => 'nullable|string|max:20',
        ];

        // Validation conditionnelle selon le rôle
        $roleRules = [];

        if ($request->role === 'patient') {
            $roleRules = [
                'patient.numero_assurance' => 'nullable|string|unique:patients,numero_assurance',
                'patient.adresse' => 'required|string',
                'patient.date_naissance' => 'required|date',
                'patient.sexe' => 'required|in:M,F,Autre',
                'patient.groupe_sanguin' => 'nullable|string',
                'patient.antecedent_medicaux' => 'nullable|string',
            ];
        } elseif ($request->role === 'medecin') {
            $roleRules = [
                'medecin.specialite' => 'required|string|max:255',
                'medecin.numero_ordre' => 'required|string|unique:medecins,numero_ordre',
                'medecin.tarif_consultation' => 'required|numeric|min:0',
                'medecin.horaire_consultation' => 'nullable|json',
                'medecin.disponible' => 'sometimes|boolean',
            ];
        }

        $validator = Validator::make($request->all(), array_merge($baseRules, $roleRules));

        if ($validator->fails()) {
            return response()->json([
                'type' => 'VALIDATION_ERROR',
                'message' => 'Erreur de validation',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // 1. Créer l'utilisateur
            $user = User::create([
                'prenom' => $request->prenom,
                'nom' => $request->nom,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
                'actif' => $request->actif ?? true,
                'telephone' => $request->telephone,
            ]);

            Log::info('UserController store - Utilisateur créé:', ['user_id' => $user->id]);

            // 2. Créer l'enregistrement spécifique selon le rôle
            switch ($request->role) {
                case 'patient':
                    $patientData = [
                        'user_id' => $user->id,
                        'numero_assurance' => $request->input('patient.numero_assurance'),
                        'adresse' => $request->input('patient.adresse'),
                        'date_naissance' => $request->input('patient.date_naissance'),
                        'sexe' => $request->input('patient.sexe'),
                        'groupe_sanguin' => $request->input('patient.groupe_sanguin'),
                        'antecedent_medicaux' => $request->input('patient.antecedent_medicaux', ''),
                    ];

                    Log::info('UserController store - Création patient avec données:', $patientData);

                    Patient::create($patientData);
                    break;

                case 'medecin':
                    $medecinData = [
                        'user_id' => $user->id,
                        'specialite' => $request->input('medecin.specialite'),
                        'numero_ordre' => $request->input('medecin.numero_ordre'),
                        'tarif_consultation' => $request->input('medecin.tarif_consultation'),
                        'horaire_consultation' => $request->input('medecin.horaire_consultation'),
                        'disponible' => $request->input('medecin.disponible', true),
                    ];

                    Log::info('UserController store - Création médecin avec données:', $medecinData);

                    Medecin::create($medecinData);
                    break;

                case 'personnel':
                    Personnel::create([
                        'user_id' => $user->id,
                        'poste' => $request->input('personnel.poste', 'Assistant'),
                        'departement' => $request->input('personnel.departement', 'Général'),
                    ]);
                    break;

                case 'administrateur':
                    Administrateur::create([
                        'user_id' => $user->id,
                        'niveau_acces' => $request->input('administrateur.niveau_acces', 'standard'),
                    ]);
                    break;
            }

            DB::commit();

            // Recharger l'utilisateur avec ses relations pour la réponse
            $userWithRelations = User::with(['patient', 'medecin', 'personnel', 'administrateur'])->find($user->id);

            Log::info('UserController store - Succès:', ['user' => $userWithRelations]);

            return response()->json([
                'message' => 'Utilisateur créé avec succès',
                'data' => $userWithRelations
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('UserController store - Erreur:', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur lors de la création: ' . $e->getMessage()
            ], 500);
        }
    }

    public function show(User $user)
    {
        return response()->json($user->load(['patient', 'medecin', 'personnel', 'administrateur']));
    }

    public function update(Request $request, User $user)
    {
        Log::info('UserController update - Données reçues:', $request->all());
        Log::info('UserController update - User ID:', ['user_id' => $user->id]);

        // Validation des données de base
        $baseRules = [
            'prenom' => 'sometimes|required|string|max:255',
            'nom' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $user->id,
            'actif' => 'sometimes|boolean',
            'telephone' => 'sometimes|nullable|string|max:20',
            'password' => 'sometimes|string|min:8',
            // Ajouter les champs pour personnel et administrateur
            'poste' => 'sometimes|nullable|string|max:255',
        ];

        // Validation conditionnelle selon le rôle
        $roleRules = [];

        if ($user->role === 'patient') {
            $currentPatient = $user->patient;
            $patientId = $currentPatient ? $currentPatient->id : null;

            $roleRules = [
                'patient.numero_assurance' => 'sometimes|nullable|string|unique:patients,numero_assurance,' . $patientId,
                'patient.adresse' => 'sometimes|required|string',
                'patient.date_naissance' => 'sometimes|required|date',
                'patient.sexe' => 'sometimes|required|in:M,F,Autre',
                'patient.groupe_sanguin' => 'sometimes|nullable|string',
                'patient.antecedent_medicaux' => 'sometimes|nullable|string',
            ];
        } elseif ($user->role === 'medecin') {
            $currentMedecin = $user->medecin;
            $medecinId = $currentMedecin ? $currentMedecin->id : null;

            $roleRules = [
                'medecin.specialite' => 'sometimes|required|string|max:255',
                'medecin.numero_ordre' => 'sometimes|required|string|unique:medecins,numero_ordre,' . $medecinId,
                'medecin.tarif_consultation' => 'sometimes|required|numeric|min:0',
                'medecin.horaire_consultation' => 'sometimes|nullable|json',
                'medecin.disponible' => 'sometimes|boolean',
            ];
        } elseif ($user->role === 'personnel' || $user->role === 'administrateur') {
            $roleRules = [
                'poste' => 'sometimes|required|string|max:255',
            ];
        }

        $validator = Validator::make($request->all(), array_merge($baseRules, $roleRules));

        if ($validator->fails()) {
            return response()->json([
                'type' => 'VALIDATION_ERROR',
                'message' => 'Erreur de validation',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Mettre à jour les données utilisateur
            $userData = $request->only(['prenom', 'nom', 'email', 'actif', 'telephone']);
            if ($request->has('password')) {
                $userData['password'] = Hash::make($request->password);
            }

            $user->update(array_filter($userData, function($value) {
                return $value !== null;
            }));

            Log::info('UserController update - Utilisateur mis à jour:', ['user_id' => $user->id]);

            // Mettre à jour les relations selon le rôle
            if ($user->role === 'patient' && $request->has('patient')) {
                $patientData = $request->input('patient');
                Log::info('UserController update - Données patient:', $patientData);

                if ($user->patient) {
                    $user->patient->update($patientData);
                } else {
                    $patientData['user_id'] = $user->id;
                    // S'assurer que numero_assurance a une valeur
                    if (empty($patientData['numero_assurance'])) {
                        $patientData['numero_assurance'] = 'TEMP-' . $user->id;
                    }
                    Patient::create($patientData);
                }
            }

            if ($user->role === 'medecin' && $request->has('medecin')) {
                $medecinData = $request->input('medecin');
                Log::info('UserController update - Données médecin:', $medecinData);

                if ($user->medecin) {
                    $user->medecin->update($medecinData);
                } else {
                    $medecinData['user_id'] = $user->id;
                    Medecin::create($medecinData);
                }
            }

            // Correction pour personnel
            if ($user->role === 'personnel') {
                $personnelData = [
                    'user_id' => $user->id,
                    'poste' => $request->input('poste', 'Assistant'),
                    'departement' => $request->input('departement', 'Général'),
                ];

                Log::info('UserController update - Données personnel:', $personnelData);

                if ($user->personnel) {
                    $user->personnel->update($personnelData);
                } else {
                    Personnel::create($personnelData);
                }
            }

            // Correction pour administrateur
            if ($user->role === 'administrateur') {
                $adminData = [
                    'user_id' => $user->id,
                    'poste' => $request->input('poste', 'Administrateur'),
                    'niveau_acces' => $request->input('niveau_acces', 'standard'),
                ];

                Log::info('UserController update - Données administrateur:', $adminData);

                if ($user->administrateur) {
                    $user->administrateur->update($adminData);
                } else {
                    Administrateur::create($adminData);
                }
            }

            DB::commit();

            // Recharger l'utilisateur avec ses relations
            $userWithRelations = User::with(['patient', 'medecin', 'personnel', 'administrateur'])->find($user->id);

            Log::info('UserController update - Succès:', ['user_id' => $userWithRelations->id]);

            return response()->json([
                'message' => 'Utilisateur mis à jour avec succès',
                'data' => $userWithRelations
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('UserController update - Erreur:', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy(User $user)
    {
        try {
            DB::beginTransaction();

            // Supprime les relations associées
            $user->patient()->delete();
            $user->medecin()->delete();
            $user->personnel()->delete();
            $user->administrateur()->delete();

            // Supprime l'utilisateur
            $user->delete();

            DB::commit();
            return response()->json(['message' => 'Utilisateur supprimé avec succès']);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('UserController destroy - Erreur:', ['error' => $e->getMessage()]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateStatus(Request $request, User $user)
    {
        $validator = Validator::make($request->all(), [
            'actif' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'type' => 'VALIDATION_ERROR',
                'message' => 'Erreur de validation',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user->update(['actif' => $request->actif]);
            return response()->json([
                'message' => 'Statut mis à jour avec succès',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            Log::error('UserController updateStatus - Erreur:', ['error' => $e->getMessage()]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur lors de la mise à jour du statut: ' . $e->getMessage()
            ], 500);
        }
    }
}
