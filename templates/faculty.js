$(document).ready(function () {
    // ==================== PROFILE SAVE FUNCTIONALITY ====================
    
    // Save profile button click
    $('#saveProfileBtn').on('click', function() {
        var fullName = $('#profileFullName').val();
        var email = $('#profileEmail').val();
        
        if (!fullName || !email) {
            showToast('warning', 'Missing Information', 'Please fill in all required fields');
            return;
        }
        
        // Validate email format
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('error', 'Invalid Email', 'Please enter a valid email address');
            return;
        }
        
        $.ajax({
            url: '/update_faculty_profile',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                full_name: fullName,
                email: email
            }),
            success: function(response) {
                if (response.success) {
                    showToast('success', 'Profile Updated', 'Your profile has been updated successfully');
                    // Update sidebar name
                    $('.user-name').text(fullName);
                } else {
                    showToast('error', 'Error', response.message || 'Failed to update profile');
                }
            },
            error: function() {
                showToast('error', 'Error', 'Failed to update profile');
            }
        });
    });

    // ==================== ATTENDANCE RECORDS ====================
    
    // ==================== RECORDS FILTERING ====================

    // Filter records button click
    $('#filterRecords').on('click', function () {
        var date = $('#recDate').val();

        if (!date) {
            showToast('warning', 'No Filter', 'Please select a date');
            return;
        }

        loadAttendanceRecords(null, null, date);
    });

    // Load attendance records from database
    function loadAttendanceRecords(dept, batch, date) {
        $.ajax({
            url: '/get_attendance_records',
            method: 'GET',
            data: { department: dept, batch: batch, date: date },
            success: function(response) {
                if (response.success) {
                    renderAttendanceRecords(response.records);
                } else {
                    showToast('error', 'Error', response.message || 'Failed to load records');
                }
            },
            error: function() {
                showToast('error', 'Error', 'Failed to load attendance records');
            }
        });
    }

    // Render attendance records table
    function renderAttendanceRecords(records) {
        var tableBody = $('#recordsTableBody');
        tableBody.empty();
        
        if (!records || records.length === 0) {
            tableBody.html('<tr><td colspan="5" style="text-align: center;">No records found</td></tr>');
            return;
        }
        
        records.forEach(function(record) {
            var row = $('<tr>');
            row.html(
                '<td>' + record.enrollment + '</td>' +
                '<td>' + record.name + '</td>' +
                '<td>' + record.date + '</td>' +
                '<td>' + record.lecture + '</td>' +
                '<td><span class="status-badge ' + record.status + '">' + record.status + '</span></td>'
            );
            tableBody.append(row);
        });
    }
    
    // ==================== TOAST NOTIFICATION ====================
    function showToast(type, title, message) {
        var toast = $('#toast');
        var toastIcon = toast.find('.toast-icon i');
        var toastTitle = toast.find('.toast-message h4');
        var toastMessage = toast.find('.toast-message p');
        
        // Set icon based on type
        if (type === 'success') {
            toastIcon.removeClass('fa-exclamation-circle fa-warning').addClass('fa-check-circle');
            toastIcon.css('color', '#2ecc71');
        } else if (type === 'error') {
            toastIcon.removeClass('fa-check-circle fa-warning').addClass('fa-exclamation-circle');
            toastIcon.css('color', '#e74c3c');
        } else if (type === 'warning') {
            toastIcon.removeClass('fa-check-circle fa-exclamation-circle').addClass('fa-warning');
            toastIcon.css('color', '#f39c12');
        }
        
        toastTitle.text(title);
        toastMessage.text(message);
        
        toast.addClass('show');
        
        setTimeout(function() {
            toast.removeClass('show');
        }, 3000);
    }
    
    // Close toast
    $('#toastClose').on('click', function() {
        $('#toast').removeClass('show');
    });

    // ==================== DASHBOARD STATS ====================
    
    // Load dashboard stats on page load
    function loadDashboardStats() {
        $.ajax({
            url: '/get_dashboard_stats',
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    var stats = response.stats;
                    
                    // Update stat cards
                    $('#totalStudents').text(stats.total_students || 0);
                    $('#presentToday').text(stats.present_today || 0);
                    $('#absentToday').text(stats.absent_today || 0);
                    $('#avgAttendance').text((stats.avg_attendance || 0) + '%');
                    
                    // Update recent activity
                    renderRecentActivity(response.recent_activity || []);
                }
            },
            error: function() {
                console.error('Failed to load dashboard stats');
            }
        });
    }
    
    // Render recent activity
    function renderRecentActivity(activity) {
        var container = $('#recentActivity');
        container.empty();
        
        if (activity.length === 0) {
            container.html('<div class="no-data">No recent attendance records found</div>');
            return;
        }
        
        activity.forEach(function(item) {
            var presentCount = item.present || 0;
            var totalCount = item.total || 0;
            var statusClass = presentCount > 0 ? 'present' : 'absent';
            
            var itemHtml = '<div class="recent-item">' +
                '<div class="recent-icon ' + statusClass + '">' +
                '<i class="fas fa-' + (presentCount > 0 ? 'check' : 'times') + '"></i>' +
                '</div>' +
                '<div class="recent-info">' +
                '<h4>' + (item.department || 'N/A') + ' - ' + (item.batch || 'N/A') + '</h4>' +
                '<p>' + item.lecture + '</p>' +
                '</div>' +
                '<div class="recent-status ' + statusClass + '">' +
                '<span>' + presentCount + '/' + totalCount + ' Present</span>' +
                '</div>' +
                '</div>';
            
            container.append(itemHtml);
        });
    }
    
    // Initialize dashboard
    loadDashboardStats();

    // ==================== PROFILE IMAGE UPLOAD & CROP ====================
    var cropper = null;
    var profileImageSrc = null;

    // Upload profile button click
    $('#uploadProfileBtn').on('click', function () {
        $('#profileImageInput').click();
    });

    // Profile image input change
    $('#profileImageInput').on('change', function (e) {
        if (e.target.files && e.target.files[0]) {
            var file = e.target.files[0];
            
            // Validate file type
            if (!file.type.match('image.*')) {
                showToast('error', 'Invalid File Type', 'Please upload an image file (JPG, PNG, WEBP)');
                return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                showToast('error', 'File Too Large', 'Maximum file size is 5MB');
                return;
            }
            
            // Read and show in crop modal
            var reader = new FileReader();
            reader.onload = function (event) {
                profileImageSrc = event.target.result;
                $('#cropImage').attr('src', profileImageSrc);
                $('#cropModal').addClass('show');
                
                // Initialize cropper
                if (cropper) {
                    cropper.destroy();
                }
                
                cropper = new Cropper(document.getElementById('cropImage'), {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 0.8,
                    responsive: true
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Close crop modal
    $('#cropClose, #cropCancel').on('click', function () {
        $('#cropModal').removeClass('show');
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

    // Crop zoom control
    $('#cropZoom').on('input', function () {
        if (cropper) {
            cropper.zoomTo($(this).val());
        }
    });

    // Save cropped image
    $('#cropSave').on('click', function () {
        if (cropper) {
            var canvas = cropper.getCroppedCanvas({
                width: 240,
                height: 240,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });
            
            var croppedImage = canvas.toDataURL('image/png');
            
            // Update profile preview
            $('#profilePreviewImg').attr('src', croppedImage).show();
            $('#profileImagePlaceholder').hide();
            
            // Close modal
            $('#cropModal').removeClass('show');
            cropper.destroy();
            cropper = null;
            
            showToast('success', 'Profile Updated', 'Your profile picture has been updated');
        }
    });

    // Close crop modal when clicking outside
    $('#cropModal').on('click', function (e) {
        if ($(e.target).is('#cropModal')) {
            $('#cropModal').removeClass('show');
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        }
    });

    // ==================== THEME TOGGLE ====================
    var isLight = false;

    // Function to update all theme toggle buttons
    function updateThemeButtons() {
        if (isLight) {
            $('.theme-toggle, .mobile-theme-toggle').find('i').removeClass('fa-sun').addClass('fa-moon');
        } else {
            $('.theme-toggle, .mobile-theme-toggle').find('i').removeClass('fa-moon').addClass('fa-sun');
        }
    }

    // Theme toggle for all theme buttons
    $('body').on('click', '.theme-toggle, .mobile-theme-toggle', function (e) {
        e.preventDefault();
        isLight = !isLight;
        $('body').toggleClass('light-theme', isLight);
        updateThemeButtons();
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // Load saved theme
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        isLight = true;
        $('body').addClass('light-theme');
        updateThemeButtons();
    }

    // Hamburger Menu Toggle
    $('#hamburgerMenu').on('click', function () {
        $('#sidebar').toggleClass('mobile-open');
        $('#sidebarOverlay').toggleClass('show');
        $(this).find('i').toggleClass('fa-bars fa-times');
    });

    // Close sidebar when clicking overlay
    $('#sidebarOverlay').on('click', function () {
        $('#sidebar').removeClass('mobile-open');
        $(this).removeClass('show');
        $('#hamburgerMenu').find('i').removeClass('fa-times').addClass('fa-bars');
    });

    // Close sidebar when clicking nav item (mobile)
    $('.sidebar-nav .nav-item').on('click', function () {
        // if (window.innerWidth <= 768) {
            $('#sidebar').removeClass('mobile-open');
            $('#sidebarOverlay').removeClass('show');
            $('#hamburgerMenu').find('i').removeClass('fa-times').addClass('fa-bars');
        // }
    });

    // Tab navigation
    $('.nav-item').on('click', function (e) {
        if ($(this).hasClass('logout')) return;
        e.preventDefault();

        var tabId = $(this).data('tab');

        $('.nav-item').removeClass('active');
        $(this).addClass('active');

        $('.tab-content').removeClass('active');
        $('#' + tabId).addClass('active');
    });

    // Quick actions navigation
    $('.action-btn').on('click', function () {
        var tabId = $(this).data('tab');
        
        $('.nav-item').removeClass('active');
        $('.nav-item[data-tab="' + tabId + '"]').addClass('active');
        
        $('.tab-content').removeClass('active');
        $('#' + tabId).addClass('active');
    });

    // ==================== IMAGE UPLOAD FUNCTIONALITY ====================
    
    var uploadedFile = null;
    var detectedStudents = [];

    // Set default date to today (using local timezone to avoid UTC issues)
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var yyyy = today.getFullYear();
    $('#lectureDate').val(yyyy + '-' + mm + dd);

    // Browse button click
    $('#browseBtn').on('click', function () {
        $('#fileInput').click();
    });
    
    // Upload area click - open file picker
    $('#uploadArea').on('click', function() {
        $('#fileInput').click();
    });
    
    // Upload method buttons (browse files)
    $('#uploadMethodBtn').on('click', function() {
        $('#fileInput').click();
    });

    // File input change
    $('#fileInput').on('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
            var file = e.target.files[0];
            
            // Validate file type
            if (!file.type.match('image.*')) {
                showToast('error', 'Invalid File Type', 'Please upload image files only (JPG, PNG, WEBP)');
                return;
            }
            
            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                showToast('error', 'File Too Large', 'Maximum file size is 10MB');
                return;
            }
            
            handleFileUpload(file);
        }
    });

    // Handle file upload
    function handleFileUpload(file) {
        // Validate file type
        if (!file.type.match('image.*')) {
            showToast('error', 'Invalid File Type', 'Please upload an image file (JPG, PNG, WEBP)');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', 'File Too Large', 'Maximum file size is 10MB');
            return;
        }

        uploadedFile = file;

        // Hide upload area, show preview
        $('#uploadArea').hide();
        $('#previewArea').show();

        // Display file info
        $('#fileName').text(file.name);
        $('#fileSize').text(formatFileSize(file.size));

        // Show image preview
        var reader = new FileReader();
        reader.onload = function (e) {
            $('#previewImg').attr('src', e.target.result);
            
            // Call actual face recognition API
            performFaceRecognition(file);
        };
        reader.readAsDataURL(file);
    }

    // Perform actual face recognition
    function performFaceRecognition(file) {
        $('#previewArea').hide();
        $('#processingArea').show();
        
        var formData = new FormData();
        formData.append('image', file);
        
        $.ajax({
            url: '/recognize_faces',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                $('#processingArea').hide();
                $('#detectionResults').show();
                
                if (response.success) {
                    detectedStudents = response.matched_students || [];
                    displayMatchedStudents(detectedStudents);
                    
                    if (detectedStudents.length === 0) {
                        showToast('warning', 'No Matches', 'No registered faces found in the image. Make sure students have registered their face IDs.');
                    }
                } else {
                    showToast('error', 'Error', response.message || 'Face recognition failed');
                    $('#detectedCount').text('0');
                    $('#detectedStudentsCount').text('0');
                }
            },
            error: function(xhr) {
                $('#processingArea').hide();
                $('#detectionResults').show();
                var errorMsg = 'Failed to process image';
                try {
                    var response = JSON.parse(xhr.responseText);
                    errorMsg = response.message || errorMsg;
                } catch(e) {}
                showToast('error', 'Error', errorMsg);
                $('#detectedCount').text('0');
                $('#detectedStudentsCount').text('0');
            }
        });
    }

    // Display matched students
    function displayMatchedStudents(students) {
        var facesContainer = $('#detectedFaces');
        facesContainer.empty();
        
        if (students.length === 0) {
            facesContainer.append('<p class="no-data">No students matched. Please ensure students have registered their face IDs.</p>');
            $('#detectedCount').text('0');
            $('#detectedStudentsCount').text('0');
            return;
        }
        
        // Store students for attendance saving
        detectedStudents = students;
        
        students.forEach(function(student, index) {
            var similarityPercent = Math.round((student.similarity || 0) * 100);
            
            // Build face image HTML if available
            var faceImageHtml = '';
            if (student.face_image) {
                faceImageHtml = '<img src="data:image/jpeg;base64,' + student.face_image + '" alt="' + student.name + '">';
            } else {
                faceImageHtml = '<i class="fas fa-user face-placeholder"></i>';
            }
            
            // Create face item with student name below image
            var faceItem = $('<div class="face-item-with-name">' +
                '<div class="face-image-container">' +
                faceImageHtml +
                '</div>' +
                '<span class="face-student-name">' + student.enrollment + '</span>' +
                '</div>');
            facesContainer.append(faceItem);
        });
        
        $('#detectedCount').text(students.length);
        $('#detectedStudentsCount').text(students.length);
    }

    // Simulate face detection (kept for fallback)
    function simulateFaceDetection() {
        $('#previewArea').hide();
        $('#processingArea').show();
        
        var progress = 0;
        var interval = setInterval(function () {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                setTimeout(function () {
                    $('#processingArea').hide();
                    $('#detectionResults').show();
                    
                    // Simulate detected faces
                    displayDetectedFaces();
                }, 500);
            }
            
            $('#processProgress').css('width', progress + '%');
            $('#progressText').text(Math.round(progress) + '%');
        }, 300);
    }

    // Display detected faces (fallback method)
    function displayDetectedFaces() {
        var facesContainer = $('#detectedFaces');
        facesContainer.empty();
        
        // Load actual students from database for face detection
        $.ajax({
            url: '/get_students',
            method: 'GET',
            success: function(response) {
                var dbStudents = response.students || [];
                detectedStudents = dbStudents.slice(0, 15); // Limit to 15 students
                
                if (detectedStudents.length === 0) {
                    facesContainer.append('<p class="no-data">No students found in database</p>');
                    $('#detectedCount').text('0');
                    $('#detectedStudentsCount').text('0');
                    return;
                }
                
                detectedStudents.forEach(function(student) {
                    var faceItem = $('<div class="face-item">' +
                        '<i class="fas fa-user face-placeholder"></i>' +
                        '<span class="student-name">' + student.name + '</span>' +
                        '</div>');
                    facesContainer.append(faceItem);
                });
                
                $('#detectedCount').text(detectedStudents.length);
                $('#detectedStudentsCount').text(detectedStudents.length);
            },
            error: function() {
                facesContainer.append('<p class="no-data">Failed to load students</p>');
                $('#detectedCount').text('0');
                $('#detectedStudentsCount').text('0');
            }
        });
    }

    // Remove uploaded image
    $('#removeImage').on('click', function () {
        resetUploadArea();
    });

    // Retake photo
    $('#retakeBtn').on('click', function () {
        resetUploadArea();
    });

    // Confirm attendance from detected faces
    $('#confirmAttendanceBtn').on('click', function () {
        if (detectedStudents.length === 0) {
            showToast('warning', 'No Students', 'No students detected to mark attendance');
            return;
        }
        
        // Get form values
        var lectureDate = $('#lectureDate').val();
        var timeSlot = $('#timeSlot').val();
        
        if (!lectureDate) {
            showToast('warning', 'Date Required', 'Please select a lecture date');
            return;
        }
        
        if (!timeSlot) {
            showToast('warning', 'Time Slot Required', 'Please select a time slot');
            return;
        }
        
        // Get list of present student enrollments - filter out any undefined/null values
        var presentStudents = detectedStudents
            .map(function(s) {
                return s.enrollment;
            })
            .filter(function(enrollment) {
                return enrollment && typeof enrollment === 'string' && enrollment.trim() !== '';
            });
        
        console.log('Saving attendance - present students:', presentStudents);
        console.log('Saving attendance - detected students count:', detectedStudents.length);
        console.log('Saving attendance - date:', lectureDate);
        console.log('Saving attendance - time slot:', timeSlot);
        
        // Validate we have students to save
        if (presentStudents.length === 0) {
            showToast('warning', 'No Valid Students', 'No valid student enrollments found to mark attendance');
            return;
        }
        
        $.ajax({
            url: '/save_attendance',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                present_students: presentStudents,
                date: lectureDate,
                time_slot: timeSlot
            }),
            success: function(response) {
                if (response.success) {
                    showToast('success', 'Attendance Saved', response.message);
                    
                    // Reset upload area after a delay
                    setTimeout(function () {
                        resetUploadArea();
                    }, 2000);
                } else {
                    showToast('error', 'Error', response.message || 'Failed to save attendance');
                }
            },
            error: function(xhr) {
                var errorMsg = 'Failed to save attendance';
                try {
                    var response = JSON.parse(xhr.responseText);
                    errorMsg = response.message || errorMsg;
                } catch(e) {}
                console.error('Save attendance error:', xhr.status, errorMsg);
                showToast('error', 'Error', errorMsg);
            }
        });
    });

    // Reset upload area
    function resetUploadArea() {
        uploadedFile = null;
        detectedStudents = [];
        
        $('#fileInput').val('');
        $('#uploadArea').show();
        $('#previewArea').hide();
        $('#processingArea').hide();
        $('#detectionResults').hide();
        $('#processProgress').css('width', '0%');
        $('#progressText').text('0%');
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ==================== ATTENDANCE MANAGEMENT ====================

    var attendanceData = {};
    var students = [];

    // Load students from database
    function loadStudentsFromDatabase(className, date) {
        $.ajax({
            url: '/get_students',
            method: 'GET',
            data: { class: className },
            success: function(response) {
                students = response.students || [];
                
                if (students.length === 0) {
                    $('#studentList').html('<div class="empty-state"><p>No students found for this class</p></div>');
                    $('#presentCount').text('0');
                    $('#absentCount').text('0');
                    $('#totalCount').text('0');
                    return;
                }
                
                renderStudentList();
                updateAttendanceSummary();
            },
            error: function() {
                showToast('error', 'Error', 'Failed to load students');
            }
        });
    }

    // Load students button
    $('#loadStudents').on('click', function () {
        var className = $('#attClass').val();
        var lecture = $('#timetableSlot').val();

        if (!className || !lecture) {
            showToast('error', 'Missing Information', 'Please select class and lecture');
            return;
        }

        // Update attendance summary with selected values
        var lectureText = '';
        if (lecture === '1') lectureText = 'Lecture 1 (09:00 - 09:55)';
        else if (lecture === '2') lectureText = 'Lecture 2 (09:55 - 10:50)';
        else if (lecture === '3') lectureText = 'Lecture 3 (11:00 - 11:55)';
        else if (lecture === '4') lectureText = 'Lecture 4 (11:55 - 12:50)';
        
        var today = new Date().toISOString().split('T')[0];
        $('#classSubject').text(className);
        $('#classDateTime').text(today + ' | ' + lectureText);

        // Show attendance sections
        $('#attendanceSummary').show();
        $('#attendanceListSection').show();
        $('#emptyState').hide();

        // Load students from database
        loadStudentsFromDatabase(className);
    });

    // Render student list
    function renderStudentList() {
        var listContainer = $('#studentList');
        listContainer.empty();

        attendanceData = {};

        students.forEach(function (student) {
            attendanceData[student.id] = 'present'; // Default to present

            var item = $('<div class="attendance-item" data-id="' + student.id + '">' +
                '<div class="student-info">' +
                '<div class="student-avatar">' + student.name.charAt(0) + '</div>' +
                '<div class="student-details">' +
                '<h4>' + student.name + '</h4>' +
                '<p>' + student.id + '</p>' +
                '</div>' +
                '</div>' +
                '<div class="attendance-buttons">' +
                '<button class="att-btn present-btn active" data-status="present">' +
                '<i class="fas fa-check"></i> Present' +
                '</button>' +
                '<button class="att-btn absent-btn" data-status="absent">' +
                '<i class="fas fa-times"></i> Absent' +
                '</button>' +
                '</div>' +
                '</div>');

            listContainer.append(item);
        });
    }

    // Attendance button click
    $(document).on('click', '.attendance-item .att-btn', function () {
        var item = $(this).closest('.attendance-item');
        var studentId = item.data('id');
        var status = $(this).data('status');

        attendanceData[studentId] = status;

        // Update button states
        item.find('.present-btn').removeClass('active');
        item.find('.absent-btn').removeClass('active');
        $(this).addClass('active');

        updateAttendanceSummary();
    });

    // Update attendance summary
    function updateAttendanceSummary() {
        var present = 0;
        var absent = 0;

        Object.values(attendanceData).forEach(function (status) {
            if (status === 'present') present++;
            else absent++;
        });

        $('#presentCount').text(present);
        $('#absentCount').text(absent);
        $('#totalCount').text(present + absent);
    }

    // Mark all present
    $('#markAllPresent').on('click', function () {
        $('.attendance-item').each(function () {
            var studentId = $(this).data('id');
            attendanceData[studentId] = 'present';
            $(this).find('.present-btn').addClass('active');
            $(this).find('.absent-btn').removeClass('active');
        });
        updateAttendanceSummary();
    });

    // Mark all absent
    $('#markAllAbsent').on('click', function () {
        $('.attendance-item').each(function () {
            var studentId = $(this).data('id');
            attendanceData[studentId] = 'absent';
            $(this).find('.present-btn').removeClass('active');
            $(this).find('.absent-btn').addClass('active');
        });
        updateAttendanceSummary();
    });

    // Save attendance
    $('#saveAttendance').on('click', function () {
        var className = $('#attClass').val();
        var lecture = $('#timetableSlot').val();
        var attendanceDate = new Date().toISOString().split('T')[0];
        
        if (!className || !lecture) {
            showToast('error', 'Missing Information', 'Please select class and lecture');
            return;
        }
        
        // Get present and absent students
        var presentStudents = [];
        var absentStudents = [];
        
        Object.entries(attendanceData).forEach(function([id, status]) {
            if (status === 'present') {
                presentStudents.push(id);
            } else {
                absentStudents.push(id);
            }
        });
        
        if (presentStudents.length === 0 && absentStudents.length === 0) {
            showToast('warning', 'No Students', 'No students to save');
            return;
        }
        
        $.ajax({
            url: '/save_attendance',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                present_students: presentStudents,
                absent_students: absentStudents,
                class: className,
                date: attendanceDate,
                time_slot: lecture
            }),
            success: function(response) {
                if (response.success) {
                    showToast('success', 'Attendance Saved', response.message);
                } else {
                    showToast('error', 'Error', response.message || 'Failed to save attendance');
                }
            },
            error: function() {
                showToast('error', 'Error', 'Failed to save attendance');
            }
        });
    });

    // ==================== RECORDS FILTERING ====================

    // Load attendance records from database
    function loadAttendanceRecords(dept, batch, date) {
        $.ajax({
            url: '/get_attendance_records',
            method: 'GET',
            data: { department: dept, batch: batch, date: date },
            success: function(response) {
                if (response.success) {
                    renderAttendanceRecords(response.records);
                } else {
                    showToast('error', 'Error', response.message || 'Failed to load records');
                }
            },
            error: function() {
                showToast('error', 'Error', 'Failed to load attendance records');
            }
        });
    }

    // Render attendance records table
    function renderAttendanceRecords(records) {
        var tableBody = $('#recordsTableBody');
        tableBody.empty();
        
        if (!records || records.length === 0) {
            tableBody.html('<tr><td colspan="5" style="text-align: center;">No records found</td></tr>');
            return;
        }
        
        records.forEach(function(record) {
            var row = $('<tr>');
            row.html(
                '<td>' + record.enrollment + '</td>' +
                '<td>' + record.name + '</td>' +
                '<td>' + record.date + '</td>' +
                '<td>' + record.lecture + '</td>' +
                '<td><span class="status-badge ' + record.status + '">' + record.status + '</span></td>'
            );
            tableBody.append(row);
        });
    }

    $('#filterRecords').on('click', function () {
        var date = $('#recDate').val();

        if (!date) {
            showToast('warning', 'No Filter', 'Please select a date');
            return;
        }

        loadAttendanceRecords(null, null, date);
    });

    // ==================== FACE ID SETTINGS ====================

    // Range slider value display
    $('.range-slider').on('input', function () {
        $(this).next('.range-value').text($(this).val() + '%');
    });

    // ==================== TOAST NOTIFICATIONS ====================

    function showToast(type, title, message) {
        var toast = $('#toast');
        var icon = toast.find('.toast-icon');
        
        // Set icon based on type
        if (type === 'success') {
            icon.html('<i class="fas fa-check-circle"></i>');
            icon.css('color', '#38ef7d');
        } else if (type === 'error') {
            icon.html('<i class="fas fa-exclamation-circle"></i>');
            icon.css('color', '#ff6b6b');
        }

        toast.find('.toast-message h4').text(title);
        toast.find('.toast-message p').text(message);

        toast.addClass('show');

        // Auto hide after 3 seconds
        setTimeout(function () {
            toast.removeClass('show');
        }, 3000);
    }

    // Close toast button
    $('#toastClose').on('click', function () {
        $('#toast').removeClass('show');
    });

    // Close toast when clicking outside
    $('#toast').on('click', function (e) {
        if ($(e.target).is('#toast')) {
            $(this).removeClass('show');
        }
    });
});
