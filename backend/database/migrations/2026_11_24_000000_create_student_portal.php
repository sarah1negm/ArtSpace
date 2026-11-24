<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique();
            $table->string('role')->default('member');
        });
        Schema::create('student_course_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('studio_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('expires_on');
            $table->timestamps();
        });
        Schema::create('student_fees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_course_enrollment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('studio_membership_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label');
            $table->enum('type', ['Course', 'Studio']);
            $table->unsignedInteger('amount_minor');
            $table->date('due_date');
            $table->timestamps();
        });
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_fee_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount_minor');
            $table->date('issued_on');
            $table->timestamps();
        });
        Schema::create('invoice_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount_minor');
            $table->date('paid_on');
            $table->timestamps();
        });
        Schema::create('artworks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description');
            $table->enum('category', ['Painting', 'Print', 'Other']);
            $table->unsignedInteger('price_minor');
            $table->string('image_url', 2048)->nullable();
            $table->string('image_path')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('artwork_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('artwork_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('artwork_title');
            $table->unsignedInteger('price_minor');
            $table->date('sold_on');
            $table->date('paid_on')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['artwork_sales', 'artworks', 'invoice_payments', 'invoices', 'student_fees', 'studio_memberships', 'student_course_enrollments'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn(['username', 'role']);
        });
    }
};
