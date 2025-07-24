    <?php

    use App\Http\Controllers\API\UserController;
    use Illuminate\Http\Request;
    use Illuminate\Support\Facades\Route;
    use App\Http\Controllers\API\AuthController;
    use App\Http\Controllers\API\PatientController;
    use App\Http\Controllers\API\MedecinController;
    use App\Http\Controllers\API\PersonnelController;
    use App\Http\Controllers\API\AdministrateurController;
    use App\Http\Controllers\API\DossierMedicalController;
    use App\Http\Controllers\API\ConsultationController;
    use App\Http\Controllers\API\PrescriptionController;
    use App\Http\Controllers\API\RendezVousController;
    use App\Http\Controllers\API\PaiementController;
    use App\Http\Controllers\API\FactureController;

    use App\Http\Controllers\API\NotificationController;
    use App\Http\Controllers\API\RoleController;
    use App\Http\Controllers\API\RapportController;
    use App\Http\Controllers\API\ScheduleController;

    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/profile', [AuthController::class, 'profile']);

        Route::apiResource('patients', PatientController::class);
        Route::apiResource('medecins', MedecinController::class);
        Route::apiResource('personnels', PersonnelController::class);
        Route::apiResource('administrateurs', AdministrateurController::class);
        Route::apiResource('dossier-medicals', DossierMedicalController::class);
        Route::apiResource('consultations', ConsultationController::class);
        Route::apiResource('prescriptions', PrescriptionController::class);
        Route::apiResource('rendez-vous', RendezVousController::class);
        Route::apiResource('paiements', PaiementController::class);
        Route::apiResource('factures', FactureController::class);
        Route::apiResource('notifications', NotificationController::class);
        Route::apiResource('rapports', RapportController::class);
        Route::apiResource('users', UserController::class);
        Route::patch('/users/{user}/status', [UserController::class, 'updateStatus']);
        Route::apiResource('roles', RoleController::class);
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{id}', [RoleController::class, 'update']);
        Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
        //Route::get('/permissions', [PermissionController::class, 'index']);
        Route::get('/schedules', [ScheduleController::class, 'index']);
        Route::get('/medecins/{medecinId}/schedules', [MedecinController::class, 'getSchedules']);
        Route::post('/schedules/{userId}', [ScheduleController::class, 'store']); // Création
        Route::put('/schedules/{id}', [ScheduleController::class, 'update']);     // Mise à jour

        Route::apiResource('schedules', ScheduleController::class);
        Route::patch('/rendez-vous/{rendezVous}/statut', [RendezVousController::class, 'updateStatut']);
        Route::patch('/rendez-vous/{rendezVous}/reschedule', [RendezVousController::class, 'reschedule']);
        Route::post('/check-availability', [RendezVousController::class, 'checkAvailability']);


        Route::post('/check-availability', [RendezVousController::class, 'checkAvailability']);
    });
