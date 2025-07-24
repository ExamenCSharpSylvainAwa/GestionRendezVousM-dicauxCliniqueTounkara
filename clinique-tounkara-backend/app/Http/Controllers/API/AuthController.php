<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Patient;
use App\Models\Medecin;
use App\Models\Personnel;
use App\Models\Administrateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        Log::info('Requête d\'inscription reçue : ' . json_encode($request->all()));

        $validator = Validator::make($request->all(), [
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'telephone' => 'required|string|max:20',
            'adresse' => 'required|string|max:255',
            'role' => 'required|in:patient,medecin,personnel,administrateur',
            'date_naissance' => 'required_if:role,patient|date',
            'sexe' => 'required_if:role,patient|in:M,F,A',
            'groupe_sanguin' => 'nullable|in:A+,A-,B+,B-,AB+,AB-,O+,O-',
        ]);

        if ($validator->fails()) {
            Log::error('Validation échouée : ' . json_encode($validator->errors()->toArray()));
            return response()->json([
                'message' => 'Erreur de validation',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = [
            'nom' => $request->nom,
            'prenom' => $request->prenom,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'telephone' => $request->telephone,
            'role' => $request->role,
            'actif' => true,
        ];
        Log::info('Données à insérer dans users : ' . json_encode(array_merge($data, ['password' => '[MASQUÉ]'])));

        try {
            DB::beginTransaction();

            $user = User::create($data);
            Log::info('Utilisateur créé avec succès. ID : ' . $user->id . ' - Données : ' . json_encode($user->toArray()));

            $this->createRoleSpecificRecord($user, $request->all(), $request->role); // Passer $request->all()
            Log::info('Enregistrement spécifique créé pour rôle : ' . $request->role);

            $token = $user->createToken('auth_token')->plainTextToken;
            Log::info('Token généré pour utilisateur ID : ' . $user->id);

            DB::commit();

            return response()->json([
                'message' => 'Inscription réussie',
                'user' => $user->load($request->role),
                'access_token' => $token,
                'token_type' => 'Bearer',
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erreur lors de l\'inscription : ' . $e->getMessage() . ' - Ligne : ' . $e->getLine() . ' - Fichier : ' . $e->getFile() . ' - Trace : ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Erreur serveur lors de l\'inscription',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function createRoleSpecificRecord(User $user, array $requestData, string $role)
    {
        Log::info('Création enregistrement spécifique pour rôle : ' . $role);
        try {
            switch ($role) {
                case 'patient':
                    Patient::create([
                        'user_id' => $user->id,
                        'numero_assurance' => 'ASS' . str_pad($user->id, 6, '0', STR_PAD_LEFT),
                        'adresse' => $requestData['adresse'],
                        'date_naissance' => $requestData['date_naissance'],
                        'sexe' => $requestData['sexe'],
                        'groupe_sanguin' => $requestData['groupe_sanguin'] ?? null,
                    ]);
                    break;

                case 'medecin':
                    $medecinData = [
                        'user_id' => $user->id,
                        'numero_ordre' => 'MED' . str_pad($user->id, 6, '0', STR_PAD_LEFT),
                        'specialite' => 'Généraliste', // Valeur par défaut si requis
                    ];
                    Log::info('Données à insérer dans medecins : ' . json_encode($medecinData));
                    Medecin::create($medecinData);
                    Log::info('Médecin créé avec succès pour user_id : ' . $user->id);
                    break;

                case 'personnel':
                    $personnelData = [
                        'user_id' => $user->id,
                        'numero_badge' => 'PER' . str_pad($user->id, 6, '0', STR_PAD_LEFT),
                        'poste' => 'Assistant', // Valeur par défaut si requis
                    ];
                    Log::info('Données à insérer dans personnel : ' . json_encode($personnelData));
                    Personnel::create($personnelData);
                    Log::info('Personnel créé avec succès pour user_id : ' . $user->id);
                    break;

                case 'administrateur':
                    $adminData = [
                        'user_id' => $user->id,
                        'niveau' => 'standard',
                        'permissions' => 'all', // Ou une chaîne simple selon votre logique
                    ];
                    Log::info('Données à insérer dans administrateurs : ' . json_encode($adminData));
                    Administrateur::create($adminData);
                    Log::info('Administrateur créé avec succès pour user_id : ' . $user->id);
                    break;
            }
        } catch (\Exception $e) {
            Log::error('Erreur dans createRoleSpecificRecord : ' . $e->getMessage());
            throw $e;
        }
    }

    public function login(Request $request)
    {
        Log::info('Requête de connexion reçue pour email : ' . $request->email);

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            Log::error('Validation échouée : ' . json_encode($validator->errors()->toArray()));
            return response()->json([
                'message' => 'Erreur de validation',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();
        Log::info('Utilisateur trouvé : ' . ($user ? 'Oui (ID: ' . $user->id . ')' : 'Non'));

        if (!$user || !Hash::check($request->password, $user->password)) {
            Log::warning('Identifiants invalides pour email : ' . $request->email);
            return response()->json(['message' => 'Identifiants invalides'], 401);
        }

        if (!$user->actif) {
            Log::warning('Compte désactivé pour email : ' . $request->email);
            return response()->json(['message' => 'Compte désactivé'], 403);
        }

        // Révocation des anciens tokens (optionnel)
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;
        Log::info('Token généré pour login utilisateur ID : ' . $user->id);

        return response()->json([
            'message' => 'Connexion réussie',
            'user' => $user->load($user->role), // Charge la relation correspondante
            'access_token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function logout(Request $request)
    {
        Log::info('Déconnexion demandée pour utilisateur : ' . $request->user()->id);
        $request->user()->currentAccessToken()->delete();
        Log::info('Token supprimé avec succès');
        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function profile(Request $request)
    {
        Log::info('Requête de profil pour utilisateur : ' . $request->user()->id);
        $user = $request->user()->load($request->user()->role);
        return response()->json([
            'user' => $user
        ]);
    }
}
