from flask import Flask, redirect, render_template, url_for, flash, request, session, jsonify, send_file
from functools import wraps
import io
import smtplib
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.utils import formataddr
import pandas as pd
import re
import random
import numpy as np
import cv2
import insightface
from insightface.app import FaceAnalysis
from numpy.linalg import norm
from db import db_connection

app = Flask(__name__)
app.secret_key = "supersecretkey"


def send_credentials_email(email, name, user_id, password, role):
    
    # Sender email (system email used to send credentials)
    sender = "developer16.balajitechs@gmail.com"
    
    # Gmail App Password (not your normal Gmail password)
    # Must be generated from Google Account → Security → App Passwords
    app_password = "dsjq avmf dtdo bedq"

    # Email body message
    # Using f-string to dynamically insert user details
    message = f"""
Hello {name},

Your EDUSYNC account has been created.

Role : {role}
User ID : {user_id}
Password : {password}

Please login and change your password after first login.

Login URL : http://localhost:5000

Regards,
EDUSYNC Admin
"""

    # Create MIME email object with the message text
    msg = MIMEText(message)

    # Email subject line
    msg["Subject"] = "EDUSYNC Login Credentials"

    # Sender name + email
    msg["From"] = formataddr(("EDUSYNC", sender))

    # Receiver email address
    msg["To"] = email

    # Connect to Gmail SMTP server
    server = smtplib.SMTP("smtp.gmail.com", 587)

    # Start TLS encryption for secure connection
    server.starttls()

    # Login to Gmail SMTP using sender email and app password
    server.login(sender, app_password)

    # Send email
    # Parameters: sender_email, receiver_email, full_message
    server.sendmail(sender, email, msg.as_string())

    # Close the SMTP connection
    server.quit()


# Initialize Face Detection + Embedding model
face_model = FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
face_model.prepare(ctx_id=0, det_size=(640,640))

def cosine_similarity(a, b):
    return np.dot(a, b) / (norm(a) * norm(b))

def load_known_faces():
    cursor.execute("SELECT enrollment, embedding FROM face_embeddings")
    rows = cursor.fetchall()

    known_faces = []

    for row in rows:
        embedding_blob = row["embedding"]
        embedding = np.frombuffer(embedding_blob, dtype="float32")

        known_faces.append({
            "enrollment": row["enrollment"],
            "embedding": embedding
        })

    return known_faces

# Cache control headers to prevent back button after logout
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# Session check decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please login first", "error")
            return redirect(url_for("home"))
        return f(*args, **kwargs)
    return decorated_function

conn = db_connection()
cursor = conn.cursor()

@app.route("/", methods=["GET", "POST"])
def home():

    if request.method == "POST":
        user_id = request.form.get("userId")
        password = request.form.get("password")

        # Check user exists
        cursor.execute("SELECT * FROM users WHERE user_id=%s", (user_id,))
        user = cursor.fetchone()

        if not user:
            flash("User not registered. Please register first.", "error")
            return redirect(url_for("register"))

        # Check password
        if user["password"] != password:
            flash("Password does not match", "error")
            return render_template("login.html")

        role = user["role"]

        # Set session variables
        session["user_id"] = user_id
        session["role"] = role
        session["logged_in"] = True

        if role == "admin":
            return redirect(url_for("admin"))

        elif role == "student":
            return redirect(url_for("student"))

        elif role == "mentor":
            return redirect(url_for("mentor"))

        elif role == "faculty":
            return redirect(url_for("faculty"))

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":
        user_id = request.form.get("userId")
        password = request.form.get("password")
        confirm_password = request.form.get("confirmPassword")

        if confirm_password != password:
            flash("Passwords do not match", "error")
            return render_template("register.html")

        # Check if already registered
        cursor.execute("SELECT user_id FROM users WHERE user_id=%s", (user_id,))
        existing_user = cursor.fetchone()

        if existing_user:
            flash("User already registered. Please login.", "warning")
            return redirect(url_for("home"))

        # Check enrollment exists in students table
        cursor.execute("SELECT enrollment FROM students WHERE enrollment=%s", (user_id,))
        student = cursor.fetchone()

        if not student:
            flash("Enrollment not found", "error")
            return render_template("register.html")

        # Insert user
        cursor.execute(
            "INSERT INTO users (user_id, password) VALUES (%s, %s)",
            (user_id, password)
        )

        conn.commit()

        flash("Registration successful. Please login.", "success")
        return redirect(url_for("home"))

    return render_template("register.html")


@app.route("/admin")
@login_required
def admin():
    # Check if user is admin
    if session.get("role") != "admin":
        flash("Access denied", "error")
        return redirect(url_for("home"))

    # Get students
    cursor.execute("SELECT * FROM students")
    students = cursor.fetchall()

    # Get faculty
    cursor.execute("SELECT * FROM faculty")
    all_faculty = cursor.fetchall()
    
    # Get mentor
    cursor.execute("SELECT * FROM mentors")
    mentors = cursor.fetchall()
    

    return render_template(
        "admin.html",
        students=students,
        faculty = all_faculty,
        mentors=mentors
    )


@app.route("/student")
@login_required
def student():
    # Check if user is student
    if session.get("role") != "student":
        flash("Access denied", "error")
        return redirect(url_for("home"))
    
        
    conn = db_connection()
    cursor = conn.cursor()
    
    # Get student profile data from database
    user_id = session.get("user_id")
    cursor.execute(
        "SELECT enrollment, name, email, phone_no, address, department, batch FROM students WHERE enrollment = %s",
        (user_id,)
    )
    student_data = cursor.fetchone()
    
    return render_template(
        "student.html",
        student=student_data
    )


@app.route("/get_student_attendance", methods=["GET"])
@login_required
def get_student_attendance():
    # Check if user is student
    if session.get("role") != "student":
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        conn = db_connection()
        cursor = conn.cursor()
        
        user_id = session.get("user_id")
        print(f"[DEBUG] Getting attendance for enrollment: {user_id}")
        
        # First get student's department and batch
        cursor.execute(
            "SELECT department, batch, class FROM students WHERE enrollment = %s",
            (user_id,)
        )
        student = cursor.fetchone()
        
        if not student:
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "data": {
                    "present": 0,
                    "absent": 104,  # Monthly target
                    "total": 104,   # 4 lectures × 6 days × ~4.33 weeks = 104
                    "percentage": 0,
                    "weekly": []
                }
            })
        
        # Get student's attendance count
        cursor.execute("""
            SELECT COUNT(*) as present
            FROM attendance
            WHERE enrollment_no = %s AND status = 'present'
        """, (user_id,))
        attendance = cursor.fetchone()
        
        present = attendance['present'] or 0
        
        # Calculate monthly target: 4 lectures × 6 days × ~4.33 weeks = 104 lectures per month
        monthly_target = 104
        total = monthly_target
        absent = max(0, total - present)  # Cannot be negative
        percentage = round((present / total) * 100, 2) if total > 0 else 0.0
        
        print(f"[DEBUG] Attendance - present: {present}, absent: {absent}, percentage: {percentage}%")
        
        # Get weekly attendance (last 7 days)
        cursor.execute("""
            SELECT 
                DAYNAME(attendance_date) as day,
                attendance_date as date,
                COUNT(*) as count
            FROM attendance
            WHERE enrollment_no = %s
            AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            AND status = 'present'
            GROUP BY DAYNAME(attendance_date), attendance_date
            ORDER BY attendance_date
        """, (user_id,))
        weekly_raw = cursor.fetchall()
        
        # Format weekly data
        weekly = []
        days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        weekly_dict = {}
        
        for row in weekly_raw:
            day_name = row['day']
            if day_name and row['count']:
                weekly_dict[day_name] = 100  # 100% if they have attendance that day
        
        for day in days_order:
            if day in weekly_dict:
                weekly.append({"day": day, "percentage": weekly_dict[day]})
            else:
                weekly.append({"day": day, "percentage": 0})
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "data": {
                "present": present,
                "absent": absent,
                "total": total,  # 104 lectures per month
                "percentage": percentage,
                "weekly": weekly
            }
        })
        
    except Exception as e:
        import traceback
        print(f"[ERROR] get_student_attendance: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/get_student_attendance_records", methods=["GET"])
@login_required
def get_student_attendance_records():
    # Check if user is student
    if session.get("role") != "student":
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        conn = db_connection()
        cursor = conn.cursor()
        
        user_id = session.get("user_id")
        
        # Get attendance records for this student
        cursor.execute("""
            SELECT attendance_date, lecture_no, status
            FROM attendance 
            WHERE enrollment_no = %s AND status = 'present'
            ORDER BY attendance_date DESC, lecture_no DESC
            LIMIT 30
        """, (user_id,))
        records = cursor.fetchall()
        
        formatted_records = []
        for row in records:
            # Get status from database, default to 'Present' for backward compatibility
            status = row.get('status', 'present')
            if not status:
                status = 'present'
            # Format status for display
            display_status = 'Present' if status == 'present' else 'Absent'
            formatted_records.append({
                "date": str(row['attendance_date']) if row['attendance_date'] else 'N/A',
                "lecture": str(row['lecture_no']) if row['lecture_no'] else 'N/A',
                "status": display_status
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "records": formatted_records
        })
        
    except Exception as e:
        import traceback
        print(f"[ERROR] get_student_attendance_records: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/mentor")
@login_required
def mentor():
    # Check if user is mentor
    if session.get("role") != "mentor":
        flash("Access denied", "error")
        return redirect(url_for("home"))
    
    conn = db_connection()
    cursor = conn.cursor()

    # Get mentor profile data
    mentor_id = session.get("user_id")
    cursor.execute("SELECT * FROM mentors WHERE generated_id = %s", (mentor_id,))
    mentor = cursor.fetchone()
    
    # Get students assigned to this mentor's class
    if mentor and mentor.get('class'):
        cursor.execute("SELECT * FROM students WHERE class = %s", (mentor['class'],))
        students = cursor.fetchall()
    else:
        students = []
    
    return render_template(
        "mentor.html",
        students=students,
        mentor=mentor
    )


@app.route("/get_mentor_student_attendance", methods=["GET"])
@login_required
def get_mentor_student_attendance():
    if session.get("role") != "mentor":
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        mentor_id = session.get("user_id")
        cursor.execute("SELECT class FROM mentors WHERE generated_id = %s", (mentor_id,))
        mentor = cursor.fetchone()
        
        if not mentor or not mentor.get('class'):
            return jsonify({"success": True, "students": []})
        
        class_name = mentor['class']
        
        # Get current month date range
        import datetime
        now = datetime.datetime.now()
        start_of_month = datetime.datetime(now.year, now.month, 1).strftime('%Y-%m-%d')
        if now.month == 12:
            end_of_month = datetime.datetime(now.year + 1, 1, 1).strftime('%Y-%m-%d')
        else:
            end_of_month = datetime.datetime(now.year, now.month + 1, 1).strftime('%Y-%m-%d')
        
        # Total lectures per month (fixed at 104)
        total_lectures_per_month = 104
        
        # Get all students for this class
        cursor.execute("SELECT enrollment, name, class FROM students WHERE class = %s", (class_name,))
        students = cursor.fetchall()
        
        # Get attendance count for each student for current month
        result = []
        for student in students:
            enrollment = student['enrollment']
            
            # Count present lectures for this student in current month
            cursor.execute("""
                SELECT COUNT(DISTINCT CONCAT(attendance_date, '-', lecture_no)) as present_count
                FROM attendance
                WHERE enrollment_no = %s
                AND attendance_date >= %s
                AND attendance_date < %s
                AND status = 'present'
            """, (enrollment, start_of_month, end_of_month))
            present_result = cursor.fetchone()
            present = present_result['present_count'] if present_result else 0
            
            # Calculate absent (total lectures - present)
            absent = max(0, total_lectures_per_month - present)
            
            # Calculate attendance percentage
            attendance = round((present / total_lectures_per_month) * 100, 2) if total_lectures_per_month > 0 else 0
            
            result.append({
                "id": enrollment,
                "enrollment": enrollment,
                "name": student['name'],
                "class": student['class'],
                "present": present,
                "absent": absent,
                "attendance": attendance,
                "total_lectures": total_lectures_per_month,
                "month": now.strftime('%B %Y')
            })
        
        return jsonify({"success": True, "students": result})
    
    except Exception as e:
        import traceback
        print(f"[ERROR] get_mentor_student_attendance: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/get_student_attendance_details", methods=["GET"])
@login_required
def get_student_attendance_details():
    if session.get("role") not in ["mentor", "admin", "faculty", "student"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        enrollment = request.args.get('enrollment', '')
        
        if not enrollment:
            return jsonify({"success": False, "message": "Enrollment required"}), 400
        
        # Get current month date range
        import datetime
        now = datetime.datetime.now()
        start_of_month = datetime.datetime(now.year, now.month, 1).strftime('%Y-%m-%d')
        if now.month == 12:
            end_of_month = datetime.datetime(now.year + 1, 1, 1).strftime('%Y-%m-%d')
        else:
            end_of_month = datetime.datetime(now.year, now.month + 1, 1).strftime('%Y-%m-%d')
        
        # Total lectures per month (fixed at 104)
        total_lectures_per_month = 104
        
        # Count present lectures for this student in current month
        cursor.execute("""
            SELECT COUNT(DISTINCT CONCAT(attendance_date, '-', lecture_no)) as present_count
            FROM attendance
            WHERE enrollment_no = %s
            AND attendance_date >= %s
            AND attendance_date < %s
            AND status = 'present'
        """, (enrollment, start_of_month, end_of_month))
        present_result = cursor.fetchone()
        present = present_result['present_count'] if present_result else 0
        
        # Calculate absent (total lectures - present)
        absent = max(0, total_lectures_per_month - present)
        
        # Calculate attendance percentage
        attendance = round((present / total_lectures_per_month) * 100, 2) if total_lectures_per_month > 0 else 0
        
        return jsonify({
            "success": True,
            "present": present,
            "absent": absent,
            "attendance": attendance,
            "total_lectures": total_lectures_per_month,
            "month": now.strftime('%B %Y')
        })
    
    except Exception as e:
        import traceback
        print(f"[ERROR] get_student_attendance_details: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/faculty")
@login_required
def faculty():
    # Check if user is faculty
    if session.get("role") != "faculty":
        flash("Access denied", "error")
        return redirect(url_for("home"))
    
    conn = db_connection()
    cursor = conn.cursor()
    
    # Get faculty profile data from database
    user_id = session.get("user_id")
    cursor.execute("SELECT * FROM faculty WHERE generated_id = %s",
        (user_id,)
    )
    faculty_data = cursor.fetchone()
    
    # Get distinct classes from students table for class dropdown
    cursor.execute("SELECT DISTINCT class FROM students WHERE class IS NOT NULL AND class != ''")
    classes = cursor.fetchall()
    
    # If no classes in students, get from mentors table
    if not classes:
        cursor.execute("SELECT DISTINCT class FROM mentors WHERE class IS NOT NULL AND class != ''")
        classes = cursor.fetchall()
    
    return render_template(
        "faculty.html",
        faculty=faculty_data,
        mentors=classes
    )
    
@app.route("/load_students", methods=["POST"])
@login_required
def load_students():

    class_name = request.form.get("class")
    lecture = request.form.get("lecture")

    cursor.execute(
        "SELECT enrollment, name FROM students WHERE class=%s",
        (class_name,)
    )

    students = cursor.fetchall()

    return render_template(
        "faculty.html",
        students=students,
        selected_class=class_name,
        selected_lecture=lecture
    )


@app.route("/forgot_password", methods=["GET","POST"])
def forgot_password():

    otp_sent = session.get("otp_sent", False)
    otp_verified = session.get("otp_verified", False)

    if request.method == "POST":

        # STEP 1 : SEND OTP
        if "send_otp" in request.form:

            email = request.form.get("email")

            cursor.execute(
                "SELECT enrollment FROM students WHERE email=%s",
                (email,)
            )
            student = cursor.fetchone()

            if not student:
                flash("Email not found")
                return render_template(
                    "forgotpassword.html",
                    otp_sent=False,
                    otp_verified=False
                )

            otp = random.randint(100000,999999)

            session["otp"] = str(otp)
            session["reset_email"] = email
            session["otp_sent"] = True
            session["otp_verified"] = False
            session["otp_timestamp"] = time.time()  # Store OTP generation time

            sender = "developer16.balajitechs@gmail.com"
            password = "dsjq avmf dtdo bedq"

            msg = MIMEText(f"Your OTP for password reset is: {otp}")
            msg["Subject"] = "EDUSYNC Password Reset OTP"
            msg["From"] = formataddr(("EDUSYNC", sender))
            msg["To"] = email

            server = smtplib.SMTP("smtp.gmail.com",587)
            server.starttls()
            server.login(sender,password)
            server.sendmail(sender,email,msg.as_string())
            server.quit()

            flash("OTP sent to your email")

            return render_template(
                "forgotpassword.html",
                otp_sent=True,
                otp_verified=False
            )


        # STEP 2 : VERIFY OTP
        elif "verify_otp" in request.form:

            user_otp = request.form.get("otp")

            # Check if OTP has expired (5 minutes = 300 seconds)
            otp_timestamp = session.get("otp_timestamp", 0)
            current_time = time.time()
            if current_time - otp_timestamp > 300:
                # OTP expired, clear OTP and prompt to resend
                session.pop("otp", None)
                session["otp_sent"] = False
                session["otp_verified"] = False
                flash("OTP expired. Please request a new OTP.", "error")
                return render_template(
                    "forgotpassword.html",
                    otp_sent=False,
                    otp_verified=False
                )

            if user_otp != session.get("otp"):
                flash("Invalid OTP. A new OTP has been sent to your email.", "error")
                
                # Generate new OTP
                new_otp = random.randint(100000,999999)
                session["otp"] = str(new_otp)
                session["otp_timestamp"] = time.time()  # Reset timestamp
                
                email = session.get("reset_email")
                
                sender = "developer16.balajitechs@gmail.com"
                password = "dsjq avmf dtdo bedq"
                
                msg = MIMEText(f"Your new OTP for password reset is: {new_otp}")
                msg["Subject"] = "EDUSYNC Password Reset OTP"
                msg["From"] = formataddr(("EDUSYNC", sender))
                msg["To"] = email
                
                server = smtplib.SMTP("smtp.gmail.com",587)
                server.starttls()
                server.login(sender,password)
                server.sendmail(sender,email,msg.as_string())
                server.quit()
                
                return render_template(
                    "forgotpassword.html",
                    otp_sent=True,
                    otp_verified=False
                )

            session["otp_verified"] = True

            flash("OTP verified")

            return render_template(
                "forgotpassword.html",
                otp_sent=True,
                otp_verified=True
            )


        # STEP 3 : RESET PASSWORD
        elif "reset_password" in request.form:

            new_password = request.form.get("password")
            confirm_password = request.form.get("confirm_password")

            if new_password != confirm_password:
                flash("Passwords do not match")
                return render_template(
                    "forgotpassword.html",
                    otp_sent=True,
                    otp_verified=True
                )

            email = session.get("reset_email")

            cursor.execute(
                "SELECT enrollment FROM students WHERE email=%s",
                (email,)
            )

            student = cursor.fetchone()
            user_id = student["enrollment"]

            cursor.execute(
                "UPDATE users SET password=%s WHERE user_id=%s",
                (new_password, user_id)
            )

            conn.commit()

            session.clear()

            flash("Password updated successfully")

            return redirect(url_for("home"))

        # RESEND OTP
        elif "resend_otp" in request.form:
            
            email = session.get("reset_email")
            
            if not email:
                flash("Session expired. Please start over.", "error")
                return render_template(
                    "forgotpassword.html",
                    otp_sent=False,
                    otp_verified=False
                )
            
            otp = random.randint(100000,999999)
            
            session["otp"] = str(otp)
            session["otp_sent"] = True
            session["otp_verified"] = False
            session["otp_timestamp"] = time.time()  # Store new OTP generation time
            
            sender = "developer16.balajitechs@gmail.com"
            password = "dsjq avmf dtdo bedq"
            
            msg = MIMEText(f"Your new OTP for password reset is: {otp}")
            msg["Subject"] = "EDUSYNC Password Reset OTP"
            msg["From"] = formataddr(("EDUSYNC", sender))
            msg["To"] = email
            
            server = smtplib.SMTP("smtp.gmail.com",587)
            server.starttls()
            server.login(sender,password)
            server.sendmail(sender,email,msg.as_string())
            server.quit()
            
            flash("New OTP sent to your email")
            
            return render_template(
                "forgotpassword.html",
                otp_sent=True,
                otp_verified=False
            )

    return render_template(
        "forgotpassword.html",
        otp_sent=otp_sent,
        otp_verified=otp_verified
    )

@app.route("/logout")
def logout():
    # Clear all session data
    session.clear()
    flash("Logged out successfully", "success")
    return redirect(url_for("home"))


# ADD_FACULTY_MENTOR_ID_PASSWORD_GENARATE #
@app.route("/add_faculty_mentor", methods=["POST"])
@login_required
def add_faculty_mentor():

    if session.get("role") != "admin":
        flash("Access denied", "error")
        return redirect(url_for("home"))

    role = request.form["role"]
    department = request.form["department"]
    full_name = request.form["full_name"]
    email = request.form["email"]
    designation = request.form["designation"]

    user_id = role[:3].upper() + str(random.randint(1000,9999))
    password = str(random.randint(100000,999999))

    cursor.execute("""
        INSERT INTO faculty
        (role, department, full_name, email, designation, generated_id, generated_password)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (role, department, full_name, email, designation, user_id, password))

    cursor.execute("""
        INSERT INTO users (user_id, password, role)
        VALUES (%s,%s,%s)
    """, (user_id, password, role))

    conn.commit()

    # send email
    send_credentials_email(email, full_name, user_id, password, role)

    flash("Faculty account created and credentials sent to email", "success")

    return redirect("/admin")


@app.route("/get_students")
@login_required
def get_students():
    import json
    department = request.args.get('department', '')
    batch = request.args.get('batch', '')
    class_name = request.args.get('class', '')
    
    query = "SELECT enrollment, name, email, department, batch, class FROM students WHERE 1=1"
    params = []
    
    if department:
        query += " AND department = %s"
        params.append(department)
    
    if batch:
        query += " AND batch = %s"
        params.append(batch)
    
    if class_name:
        query += " AND class = %s"
        params.append(class_name)
    
    cursor.execute(query, params)
    students = cursor.fetchall()
    
    # Convert to list of dicts
    student_list = []
    for student in students:
        student_list.append({
            'id': student['enrollment'],
            'name': student['name'],
            'email': student['email'],
            'department': student['department'],
            'batch': student['batch'],
            'class': student.get('class', '')
        })
    
    return jsonify({'students': student_list})


# ADD CLASS MENTOR #

@app.route("/add_mentor", methods=["POST"])
@login_required
def add_mentor():
    # Check if user is admin
    if session.get("role") != "admin":
        flash("Access denied", "error")
        return redirect(url_for("home"))

    faculty_id = request.form["faculty_id"]
    batch = request.form["batch"]
    class_name = request.form["class"]

    # Get faculty details
    cursor.execute("""
        SELECT full_name, department, email
        FROM faculty
        WHERE generated_id = %s
    """, (faculty_id,))

    faculty = cursor.fetchone()

    if not faculty:
        return redirect("/admin")

    name = faculty["full_name"]
    department = faculty["department"]
    email = faculty["email"]

    role = "mentor"

    # generate mentor login
    mentor_id = "MEN" + str(random.randint(1000,9999))
    password = str(random.randint(100000,999999))

    sql = """
    INSERT INTO mentors
    (generated_id, generated_password, full_name, role, department, class, batch, email)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """

    cursor.execute(sql, (
        mentor_id,
        password,
        name,
        role,
        department,
        class_name,
        batch,
        email
    ))

    add = """INSERT INTO users
    (user_id, password, role)
    VALUES (%s, %s, %s)
    """
    
    cursor.execute(add, (mentor_id, password, role))
    
    conn.commit()

    # send mentor credentials email
    send_credentials_email(email, name, mentor_id, password, "mentor")

    flash("Mentor account created and credentials sent to email", "success")

    return redirect("/admin")


# -------- Detect Column Type -------- #

def detect_type(value):

    value = str(value)

    if re.match(r"\d{2}[A-Z]{4}\d{5}", value):
        return "enrollment"

    if "@" in value:
        return "email"

    if re.match(r"\d{10}$", value):
        return "phone"

    if re.match(r"^[A-Za-z ]+$", value):
        return "name"

    return "address"

# -------- Detect Batch --------- #

def detect_batch(enrollment):

    enrollment = str(enrollment)

    # Regular BE students
    if re.match(r"\d{2}[A-Z]{4}\d{5}", enrollment):

        start_year = 2000 + int(enrollment[:2])
        end_year = start_year + 4

        return f"{start_year}-{end_year}"

    # D2D students
    if enrollment.startswith("224"):
        return "2023-2027"

    if enrollment.startswith("225"):
        return "2024-2028"

    return "Unknown"


# -------- Detect Department -------- #

def detect_department(enrollment):

    enrollment = str(enrollment).upper()

    match = re.search(r'(S?BE[A-Z]{2})', enrollment)

    if not match:
        return "Unknown"

    code = match.group(1)

    departments = {
        "BECE": "CE Department",
        "BEIT": "IT Department",
        "BEEE": "EC Department",
        "BEME": "Mechanical Department",
        "BEAE": "Automobile Department",
        "SBECE": "CE Department",
        "SBEIT": "IT Department"
    }

    return departments.get(code, "Unknown")


# -------- Upload Excel -------- #

@app.route("/upload_students", methods=["POST"])
@login_required
def upload_students():
    # Check if user is admin
    if session.get("role") != "admin":
        return jsonify({"success": False, "message": "Access denied"}), 403

    file = request.files.get("batch_excel_file")

    if not file or file.filename == "":
        return jsonify({"success": False, "message": "Please select an Excel or CSV file."}), 400

    if file.filename.endswith(".csv"):
        df = pd.read_csv(file, dtype=str)
    else:
        df = pd.read_excel(file, dtype=str)

    df = df.fillna("")

    column_map = {}

    for col in df.columns:

        sample = str(df[col].iloc[0]).strip()

        column_map[col] = detect_type(sample)

    inserted = 0

    for _, row in df.iterrows():

        enrollment = ""
        name = ""
        email = ""
        phone = ""
        address = ""

        for col in column_map:

            value = str(row[col]).strip()
            dtype = column_map[col]

            if dtype == "enrollment":
                enrollment = value

            elif dtype == "name":
                name = value

            elif dtype == "email":
                email = value

            elif dtype == "phone":
                phone = value

            elif dtype == "address":
                address = value

        department = detect_department(enrollment)
        
        batch = detect_batch(enrollment)

        sql = """
        INSERT IGNORE INTO students
        (batch, enrollment, department, name, email, phone_no, address)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        cursor.execute(sql, (batch, enrollment, department, name, email, phone, address))

        inserted += 1

    conn.commit()

    return jsonify({
        "success": True, 
        "message": f"{inserted} students imported successfully."
    })


@app.route("/download_template")
@login_required
def download_template():
    # Check if user is admin or mentor
    if session.get("role") not in ["admin", "mentor"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    # Create template dataframe with sample data
    template_data = {
        'Enrollment': ['22BEIT00001', '22BECE00002', '22BEEE00003'],
        'Name': ['John Doe', 'Jane Smith', 'Alex Johnson'],
        'Email': ['john.doe@example.com', 'jane.smith@example.com', 'alex.j@example.com'],
        'Phone': ['9876543210', '9876543211', '9876543212'],
        'Address': ['123 Main St, City', '456 Oak Ave, Town', '789 Pine Rd, Village']
    }
    
    df = pd.DataFrame(template_data)
    
    # Create Excel file in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Student Template')
    
    output.seek(0)
    
    return send_file(
        output,
        download_name='student_template.xlsx',
        as_attachment=True,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# -------- Mentor Upload Students with Class -------- #
@app.route("/mentor_upload_students", methods=["POST"])
@login_required
def mentor_upload_students():

    if session.get("role") != "mentor":
        return jsonify({"success": False, "message": "Access denied"}), 403

    mentor_id = session.get("user_id")

    # Get mentor class
    cursor.execute(
        "SELECT class FROM mentors WHERE generated_id=%s",
        (mentor_id,)
    )
    mentor = cursor.fetchone()

    if not mentor:
        return jsonify({"success": False, "message": "Mentor not found"}), 400

    mentor_class = mentor["class"]

    file = request.files.get("batch_excel_file")

    if not file:
        return jsonify({"success": False, "message": "Upload Excel file"}), 400

    # Read file
    if file.filename.endswith(".csv"):
        df = pd.read_csv(file, dtype=str)
    else:
        df = pd.read_excel(file, dtype=str)

    df = df.fillna("")

    # Detect enrollment column automatically
    enrollment_col = None

    for col in df.columns:
        for value in df[col].head(5):
            if re.match(r"\d{2}[A-Z]{4}\d{5}", str(value)):
                enrollment_col = col
                break
        if enrollment_col:
            break

    if not enrollment_col:
        return jsonify({"success": False, "message": "Enrollment column not found"}), 400

    updated = 0

    # Update class for each enrollment
    for enrollment in df[enrollment_col]:

        enrollment = str(enrollment).strip()

        if not enrollment:
            continue

        cursor.execute("""
            UPDATE students
            SET class=%s
            WHERE enrollment=%s
        """, (mentor_class, enrollment))

        updated += 1

    conn.commit()

    return jsonify({
        "success": True,
        "message": f"{updated} students assigned to class {mentor_class}"
    })
@app.route("/save_faceid", methods=["POST"])
@login_required
def save_faceid():

    if session.get("role") not in ["mentor"]:
        return jsonify({"success": False, "message": "Access denied"}), 403

    enrollment = request.form.get("enrollment")
    files = request.files.getlist("images")

    if not enrollment:
        return jsonify({"success": False, "message": "Please select student"}), 400

    if len(files) < 2 or len(files) > 5:
        return jsonify({"success": False, "message": "Upload minimum 2 and maximum 5 images"}), 400

    saved = 0

    for file in files:

        image_bytes = file.read()

        # Convert image to OpenCV format
        np_img = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        if img is None:
            continue

        faces = face_model.get(img)

        if len(faces) == 0:
            continue

        # ArcFace embedding
        embedding = faces[0].embedding

        # Convert embedding to BLOB
        embedding_blob = embedding.astype("float32").tobytes()

        cursor.execute("""
            INSERT INTO face_embeddings (enrollment, embedding, face_image)
            VALUES (%s,%s,%s)
        """, (enrollment, embedding_blob, image_bytes))

        saved += 1

    conn.commit()

    if saved == 0:
        return jsonify({"success": False, "message": "No valid faces detected in uploaded images"}), 400
    else:
        return jsonify({"success": True, "message": f"{saved} face images saved successfully"})


@app.route("/get_faceids", methods=["GET"])
@login_required
def get_faceids():
    if session.get("role") not in ["mentor"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        # Get mentor's assigned class
        mentor_id = session.get("user_id")
        cursor.execute("SELECT class FROM mentors WHERE generated_id = %s", (mentor_id,))
        mentor = cursor.fetchone()
        
        if not mentor or not mentor.get('class'):
            return jsonify({"success": True, "face_ids": []})
        
        mentor_class = mentor['class']
        
        cursor.execute("""
            SELECT fe.enrollment, COUNT(*) as image_count, MAX(fe.id) as latest_id 
            FROM face_embeddings fe
            INNER JOIN students s ON fe.enrollment = s.enrollment
            WHERE s.class = %s
            GROUP BY fe.enrollment
        """, (mentor_class,))
        face_ids = cursor.fetchall()
        
        result = []
        for row in face_ids:
            result.append({
                "enrollment": row["enrollment"],
                "image_count": row["image_count"]
            })
        
        return jsonify({"success": True, "face_ids": result})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/get_faceid_images/<enrollment>", methods=["GET"])
@login_required
def get_faceid_images(enrollment):
    if session.get("role") not in ["admin", "mentor"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        cursor.execute("""
            SELECT id, face_image FROM face_embeddings WHERE enrollment = %s
        """, (enrollment,))
        images = cursor.fetchall()
        
        result = []
        for row in images:
            import base64
            img_base64 = base64.b64encode(row["face_image"]).decode('utf-8')
            result.append({
                "id": row["id"],
                "image": f"data:image/jpeg;base64,{img_base64}"
            })
        
        return jsonify({"success": True, "images": result})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/recognize_faces", methods=["POST"])
@login_required
def recognize_faces():
    if session.get("role") not in ["admin", "mentor", "faculty"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image uploaded"}), 400
        
        file = request.files['image']
        image_bytes = file.read()
        
        # Convert to OpenCV format
        np_img = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"success": False, "message": "Invalid image"}), 400
        
        # Detect faces in the image
        faces = face_model.get(img)
        
        if len(faces) == 0:
            return jsonify({"success": True, "matched_students": [], "message": "No faces detected in image"})
        
        # Get all face embeddings from database
        cursor.execute("SELECT enrollment, embedding, face_image FROM face_embeddings")
        db_embeddings = cursor.fetchall()
        
        matched_students = []
        threshold = 0.5  # Cosine similarity threshold
        
        for face in faces:
            query_embedding = face.embedding
            
            for db_row in db_embeddings:
                # Deserialize embedding from database
                db_embedding = np.frombuffer(db_row["embedding"], dtype=np.float32)
                
                # Calculate cosine similarity
                similarity = np.dot(query_embedding, db_embedding) / (np.linalg.norm(query_embedding) * np.linalg.norm(db_embedding))
                
                if similarity > threshold:
                    enrollment = db_row["enrollment"]
                    
                    # Check if already matched (avoid duplicates)
                    if enrollment not in [s["enrollment"] for s in matched_students]:
                        # Get student details
                        cursor.execute("SELECT name, enrollment, department, batch FROM students WHERE enrollment = %s", (enrollment,))
                        student = cursor.fetchone()
                        
                        if student:
                            # Convert face_image to base64 for display
                            import base64
                            face_image_base64 = None
                            if db_row["face_image"]:
                                face_image_base64 = base64.b64encode(db_row["face_image"]).decode('utf-8')
                            
                            matched_students.append({
                                "enrollment": enrollment,
                                "name": student["name"],
                                "department": student["department"],
                                "batch": student["batch"],
                                "similarity": float(similarity),
                                "face_image": face_image_base64
                            })
        
        return jsonify({
            "success": True, 
            "matched_students": matched_students,
            "faces_detected": len(faces)
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/save_attendance", methods=["POST"])
@login_required
def save_attendance():
    if session.get("role") not in ["admin", "mentor", "faculty"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    # Create fresh database connection
    conn = db_connection()
    cursor = conn.cursor()
    
    try:
        # First, check if status column exists, if not add it
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'edu_sync' 
            AND TABLE_NAME = 'attendance' 
            AND COLUMN_NAME = 'status'
        """)
        status_column_exists = cursor.fetchone()
        
        if not status_column_exists:
            # Add status column to attendance table
            cursor.execute("ALTER TABLE attendance ADD COLUMN status VARCHAR(20) DEFAULT 'present'")
            conn.commit()
            print("[DEBUG] Added status column to attendance table")
        
        data = request.get_json()
        
        # Debug: log received data
        print(f"[DEBUG] save_attendance received data: {data}")
        
        if data is None:
            return jsonify({"success": False, "message": "No data received"}), 400
            
        present_students = data.get('present_students', [])
        absent_students = data.get('absent_students', [])
        department = data.get('department', '')
        batch = data.get('batch', '')
        lecture_date = data.get('date', '')
        time_slot = data.get('time_slot', '')
        
        # Debug: log the extracted values
        print(f"[DEBUG] present_students: {present_students}, type: {type(present_students)}")
        print(f"[DEBUG] absent_students: {absent_students}, type: {type(absent_students)}")
        print(f"[DEBUG] lecture_date: {lecture_date}, time_slot: {time_slot}")
        
        if not lecture_date:
            return jsonify({"success": False, "message": "Date is required"}), 400
        
        if not time_slot:
            return jsonify({"success": False, "message": "Time slot is required"}), 400
        
        if not present_students or not isinstance(present_students, list):
            return jsonify({"success": False, "message": "No students provided for attendance"}), 400
        
        saved = 0
        
        # Process present students
        for enrollment in present_students:
            print(f"[DEBUG] Processing enrollment: {enrollment}, date: {lecture_date}, time_slot: {time_slot}, status: present")
            
            # Check if attendance already exists for this date and lecture
            cursor.execute("""
                SELECT id FROM attendance 
                WHERE enrollment_no = %s AND attendance_date = %s AND lecture_no = %s
            """, (enrollment, lecture_date, time_slot))
            existing = cursor.fetchone()
            
            if existing:
                print(f"[DEBUG] Attendance exists, updating to present...")
                # Update existing record with status = 'present'
                cursor.execute("""
                    UPDATE attendance SET lecture_no = %s, attendance_date = %s, status = 'present'
                    WHERE enrollment_no = %s AND attendance_date = %s AND lecture_no = %s
                """, (time_slot, lecture_date, enrollment, lecture_date, time_slot))
            else:
                print(f"[DEBUG] No attendance found, inserting new record as present...")
                # Insert new record with status = 'present'
                try:
                    cursor.execute("""
                        INSERT INTO attendance (enrollment_no, lecture_no, attendance_date, status)
                        VALUES (%s, %s, %s, 'present')
                    """, (enrollment, time_slot, lecture_date))
                    print(f"[DEBUG] Insert successful for enrollment: {enrollment} with status: present")
                except Exception as insert_err:
                    print(f"[ERROR] Insert failed for {enrollment}: {str(insert_err)}")
                    return jsonify({"success": False, "message": f"Failed to insert attendance for {enrollment}: {str(insert_err)}"}), 500
            
            saved += 1
        
        # Process absent students (only if provided)
        if absent_students and len(absent_students) > 0:
            print(f"[DEBUG] Processing absent_students: {absent_students}")
            for enrollment in absent_students:
                print(f"[DEBUG] Processing absent enrollment: {enrollment}")
                # Check if attendance already exists for this date and lecture
                cursor.execute("""
                    SELECT id FROM attendance 
                    WHERE enrollment_no = %s AND attendance_date = %s AND lecture_no = %s
                """, (enrollment, lecture_date, time_slot))
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing record with status = 'absent'
                    cursor.execute("""
                        UPDATE attendance SET lecture_no = %s, attendance_date = %s, status = 'absent'
                        WHERE enrollment_no = %s AND attendance_date = %s AND lecture_no = %s
                    """, (time_slot, lecture_date, enrollment, lecture_date, time_slot))
                else:
                    # Insert new record with status = 'absent'
                    cursor.execute("""
                        INSERT INTO attendance (enrollment_no, lecture_no, attendance_date, status)
                        VALUES (%s, %s, %s, 'absent')
                    """, (enrollment, time_slot, lecture_date))
                
                saved += 1
        else:
            print("[DEBUG] No absent_students to process")
        
        conn.commit()
        
        return jsonify({
            "success": True, 
            "message": f"Attendance saved for {saved} students"
        })
        
    except Exception as e:
        import traceback
        print(f"[ERROR] save_attendance failed: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/get_attendance_records", methods=["GET"])
@login_required
def get_attendance_records():
    if session.get("role") not in ["admin", "mentor", "faculty"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        role = session.get("role")
        department = request.args.get('department', '')
        batch = request.args.get('batch', '')
        date = request.args.get('date', '')
        
        # For mentors, restrict to their assigned class
        if role == "mentor":
            mentor_id = session.get("user_id")
            cursor.execute("SELECT class FROM mentors WHERE generated_id = %s", (mentor_id,))
            mentor = cursor.fetchone()
            if mentor and mentor.get('class'):
                batch = mentor['class']  # Force to mentor's class
        
        query = """
            SELECT a.enrollment_no, s.name, s.class, a.attendance_date, a.lecture_no, a.status
            FROM attendance a
            LEFT JOIN students s ON a.enrollment_no = s.enrollment
            WHERE 1=1
        """
        params = []
        
        if department:
            query += " AND s.department = %s"
            params.append(department)
        
        if batch:
            query += " AND s.class = %s"
            params.append(batch)
        
        if date:
            query += " AND a.attendance_date = %s"
            params.append(date)
        
        query += " ORDER BY a.attendance_date DESC, a.lecture_no"
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        result = []
        for row in records:
            # Get status from database, default to 'present' for backward compatibility
            status = row.get('status', 'present')
            if not status:
                status = 'present'  # Default for old records without status
            result.append({
                "enrollment": row["enrollment_no"],
                "name": row["name"] or row["enrollment_no"],
                "batch": row["class"],
                "date": str(row["attendance_date"]) if row["attendance_date"] else '',
                "lecture": row["lecture_no"],
                "status": status,
                "subject": ""
            })
        
        return jsonify({"success": True, "records": result})
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/get_dashboard_stats", methods=["GET"])
@login_required
def get_dashboard_stats():
    if session.get("role") not in ["admin", "mentor", "faculty"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        role = session.get("role")
        user_id = session.get("user_id")
        today = datetime.now().date()
        
        # Get department filter for faculty/mentor
        dept_filter = None
        batch_filter = None
        
        if role == "faculty":
            cursor.execute("SELECT department FROM faculty WHERE generated_id = %s", (user_id,))
            faculty = cursor.fetchone()
            if faculty and faculty.get('department'):
                dept_filter = faculty['department']
        elif role == "mentor":
            cursor.execute("SELECT class FROM mentors WHERE generated_id = %s", (user_id,))
            mentor = cursor.fetchone()
            if mentor and mentor.get('class'):
                batch_filter = mentor['class']
        
        # Get total students count
        if dept_filter:
            cursor.execute("SELECT COUNT(*) as count FROM students WHERE department = %s", (dept_filter,))
        elif batch_filter:
            cursor.execute("SELECT COUNT(*) as count FROM students WHERE class = %s", (batch_filter,))
        else:
            cursor.execute("SELECT COUNT(*) as count FROM students")
        total_students = cursor.fetchone()["count"]
        
        # Get today's attendance with filtering
        if dept_filter and batch_filter:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE a.attendance_date = %s AND s.department = %s AND s.class = %s AND a.status = 'present'
            """, (today, dept_filter, batch_filter))
        elif dept_filter:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE a.attendance_date = %s AND s.department = %s AND a.status = 'present'
            """, (today, dept_filter))
        elif batch_filter:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE a.attendance_date = %s AND s.class = %s AND a.status = 'present'
            """, (today, batch_filter))
        else:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE a.attendance_date = %s AND a.status = 'present'
            """, (today,))
        today_attendance = cursor.fetchone()
        
        present_today = today_attendance["present_count"] or 0
        absent_today = 0
        
        # Calculate average attendance (all time)
        if dept_filter and batch_filter:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE s.department = %s AND s.class = %s AND a.status = 'present'
            """, (dept_filter, batch_filter))
        elif dept_filter:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE s.department = %s AND a.status = 'present'
            """, (dept_filter,))
        elif batch_filter:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE s.class = %s AND a.status = 'present'
            """, (batch_filter,))
        else:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE a.status = 'present'
            """)
        all_attendance = cursor.fetchone()
        
        if all_attendance["total"] and all_attendance["total"] > 0:
            avg_attendance = round((all_attendance["present_count"] / all_attendance["total"]) * 100)
        else:
            avg_attendance = 0
        
        # Get recent activity with filtering
        if dept_filter and batch_filter:
            cursor.execute("""
                SELECT 
                    a.attendance_date,
                    a.lecture_no,
                    COALESCE(s.department, 'N/A') as department,
                    COALESCE(s.class, 'N/A') as class,
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE s.department = %s AND s.class = %s AND a.status = 'present'
                GROUP BY a.attendance_date, a.lecture_no, COALESCE(s.department, 'N/A'), COALESCE(s.class, 'N/A')
                ORDER BY a.attendance_date DESC, a.lecture_no DESC
                LIMIT 5
            """, (dept_filter, batch_filter))
        elif dept_filter:
            cursor.execute("""
                SELECT 
                    a.attendance_date,
                    a.lecture_no,
                    COALESCE(s.department, 'N/A') as department,
                    COALESCE(s.class, 'N/A') as class,
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE s.department = %s AND a.status = 'present'
                GROUP BY a.attendance_date, a.lecture_no, COALESCE(s.department, 'N/A'), COALESCE(s.class, 'N/A')
                ORDER BY a.attendance_date DESC, a.lecture_no DESC
                LIMIT 5
            """, (dept_filter,))
        elif batch_filter:
            cursor.execute("""
                SELECT 
                    a.attendance_date,
                    a.lecture_no,
                    COALESCE(s.department, 'N/A') as department,
                    COALESCE(s.class, 'N/A') as class,
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE s.class = %s AND a.status = 'present'
                GROUP BY a.attendance_date, a.lecture_no, COALESCE(s.department, 'N/A'), COALESCE(s.class, 'N/A')
                ORDER BY a.attendance_date DESC, a.lecture_no DESC
                LIMIT 5
            """, (batch_filter,))
        else:
            cursor.execute("""
                SELECT 
                    a.attendance_date,
                    a.lecture_no,
                    COALESCE(s.department, 'N/A') as department,
                    COALESCE(s.class, 'N/A') as class,
                    COUNT(*) as total,
                    COUNT(a.id) as present_count
                FROM attendance a
                LEFT JOIN students s ON a.enrollment_no = s.enrollment
                WHERE a.status = 'present'
                GROUP BY a.attendance_date, a.lecture_no, COALESCE(s.department, 'N/A'), COALESCE(s.class, 'N/A')
                ORDER BY a.attendance_date DESC, a.lecture_no DESC
                LIMIT 5
            """)
        recent_activity = cursor.fetchall()
        
        recent_list = []
        for row in recent_activity:
            lecture_times = {
                "1": "Lecture 1 (09:00 - 09:55)",
                "2": "Lecture 2 (09:55 - 10:50)",
                "3": "Lecture 3 (11:00 - 11:55)",
                "4": "Lecture 4 (11:55 - 12:50)"
            }
            recent_list.append({
                "date": str(row["attendance_date"]) if row["attendance_date"] else '',
                "lecture": lecture_times.get(str(row["lecture_no"]), f"Lecture {row['lecture_no']}"),
                "department": row["department"] or 'N/A',
                "batch": row["class"] or 'N/A',
                "total": row["total"],
                "present": row["present_count"]
            })
        
        return jsonify({
            "success": True,
            "stats": {
                "total_students": total_students,
                "present_today": present_today,
                "absent_today": absent_today,
                "avg_attendance": avg_attendance
            },
            "recent_activity": recent_list
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/delete_faceid/<enrollment>", methods=["DELETE"])
@login_required
def delete_faceid(enrollment):
    if session.get("role") not in ["admin", "mentor"]:
        return jsonify({"success": False, "message": "Access denied"}), 403
    
    try:
        # For mentors, validate the student belongs to their class
        role = session.get("role")
        if role == "mentor":
            mentor_id = session.get("user_id")
            cursor.execute("SELECT class FROM mentors WHERE generated_id = %s", (mentor_id,))
            mentor = cursor.fetchone()
            if mentor and mentor.get('class'):
                cursor.execute("SELECT enrollment FROM students WHERE enrollment = %s AND batch = %s", (enrollment, mentor['class']))
                student = cursor.fetchone()
                if not student:
                    return jsonify({"success": False, "message": "Cannot delete face ID for student not in your class"}), 400
        
        cursor.execute("DELETE FROM face_embeddings WHERE enrollment = %s", (enrollment,))
        conn.commit()
        return jsonify({"success": True, "message": "Face ID deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    
    
@app.route("/mark_attendance", methods=["POST"])
@login_required
def mark_attendance():

    if session.get("role") not in ["admin", "mentor"]:
        flash("Access denied", "error")
        return redirect(url_for("home"))

    file = request.files.get("group_image")

    if not file:
        flash("Please upload a group image", "error")
        return redirect(url_for("mentor"))

    image_bytes = file.read()

    np_img = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    if img is None:
        flash("Invalid image", "error")
        return redirect(url_for("mentor"))

    # Detect all faces in group image
    faces = face_model.get(img)

    if len(faces) == 0:
        flash("No faces detected", "error")
        return redirect(url_for("mentor"))

    known_faces = load_known_faces()

    present_students = set()

    for face in faces:

        embedding = face.embedding

        for known in known_faces:

            similarity = cosine_similarity(embedding, known["embedding"])

            if similarity > 0.6:
                present_students.add(known["enrollment"])

    today = time.strftime("%Y-%m-%d")

    # Check if status column exists, if not add it
    cursor.execute("""
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'edu_sync'
        AND TABLE_NAME = 'attendance'
        AND COLUMN_NAME = 'status'
    """)
    status_column_exists = cursor.fetchone()

    if not status_column_exists:
        cursor.execute("ALTER TABLE attendance ADD COLUMN status VARCHAR(20) DEFAULT 'present'")
        conn.commit()

    for enrollment in present_students:
        cursor.execute("""
            INSERT INTO attendance (enrollment_no, lecture_no, attendance_date, status)
            VALUES (%s, %s, %s, 'present')
        """, (enrollment, 1, today))

    conn.commit()

    flash(f"{len(present_students)} students marked present", "success")

    return redirect(url_for("mentor"))


@app.route("/add_timetable", methods=["POST"])
def add_timetable():

    class_name = request.form["class_name"]
    subject = request.form["subject"]
    faculty_id = request.form["faculty_id"]
    day = request.form["day"]
    lecture_no = request.form["lecture_no"]

    cursor.execute("SELECT full_name FROM faculty WHERE generated_id=%s", (faculty_id,))
    faculty = cursor.fetchone()

    faculty_name = faculty["full_name"]

    cursor.execute("""
        INSERT INTO timetable (class_name, subject, faculty_name, day, lecture_no)
        VALUES (%s,%s,%s,%s,%s)
    """,(class_name, subject, faculty_name, day, lecture_no))

    conn.commit()

    flash("Lecture Added Successfully!", "success")

    return redirect(url_for("admin"))


@app.route("/api/timetable", methods=["GET"])
def get_timetable():
    """API endpoint to fetch timetable data from database"""
    class_filter = request.args.get('class_name')
    
    if class_filter:
        cursor.execute("""
            SELECT id, class_name, subject, faculty_name, day, lecture_no 
            FROM timetable 
            WHERE class_name = %s
            ORDER BY lecture_no
        """, (class_filter,))
    else:
        cursor.execute("""
            SELECT id, class_name, subject, faculty_name, day, lecture_no 
            FROM timetable 
            ORDER BY class_name, lecture_no
        """)
    
    timetable_data = cursor.fetchall()
    
    return jsonify(timetable_data)


if __name__ == "__main__":
    app.run(debug=True)