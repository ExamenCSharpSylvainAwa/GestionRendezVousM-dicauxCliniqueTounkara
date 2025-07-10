<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Personnel;
use Illuminate\Support\Facades\Validator;

class PersonnelController extends Controller
{
    public function index()
    {
        $personnels = Personnel::with('user')->paginate(10);
        return response()->json($personnels);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'poste' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $personnel = Personnel::create($request->all());
        return response()->json($personnel->load('user'), 201);
    }

    public function show(Personnel $personnel)
    {
        return response()->json($personnel->load('user'));
    }

    public function update(Request $request, Personnel $personnel)
    {
        $validator = Validator::make($request->all(), [
            'poste' => 'sometimes|required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $personnel->update($request->all());
        return response()->json($personnel->load('user'));
    }

    public function destroy(Personnel $personnel)
    {
        $personnel->delete();
        return response()->json(['message' => 'Personnel supprimé avec succès']);
    }
}
