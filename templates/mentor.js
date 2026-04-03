$(document).ready(function () {
    // Theme toggle
    var isLight = false;
    var currentPresentStudentId = null;
    var currentAttendanceAction = null;
    var presentReasons = {};
    var absentReasons = {};

    // Load mentor profile data
    var mentorData = JSON.parse($('#mentor-data').text() || '{}');
    if (mentorData && mentorData.generated_id) {
        $('#profileName').text(mentorData.full_name || mentorData.name || 'N/A');
        $('#profileGeneratedId').text(mentorData.generated_id || '-');
        $('#profileEmail').text(mentorData.email || '-');
        $('#profileDepartment').text(mentorData.department || '-');
        $('#profileDesignation').text(mentorData.designation || '-');
        $('#profileClass').text(mentorData.class || '-');
    }

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
            $('#sidebar').removeClass('mobile-open');
            $('#sidebarOverlay').removeClass('show');
            $('#hamburgerMenu').find('i').removeClass('fa-times').addClass('fa-bars');        
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
        
        // Trigger tab-specific initialization
        if (tabId === 'students' && typeof renderStudentsGrid === 'function') {
            renderStudentsGrid();
        }
        
        // Load real attendance data when Records tab is opened
        if (tabId === 'records') {
            loadStudentAttendance();
        }
    });
    
    // Initialize with profile tab active
    $('.nav-item[data-tab="profile"]').addClass('active');
    $('.tab-content').removeClass('active');
    $('#profile').addClass('active');

    // Close modal
    $('#closeModal').on('click', function () {
        $('#studentModal').removeClass('show');
    });

    // Close modal when clicking outside
    $('#studentModal').on('click', function (e) {
        if ($(e.target).is('#studentModal')) {
            $('#studentModal').removeClass('show');
        }
    });

    // Reason Modal handlers
    $('#closeReasonModal, #cancelReason').on('click', function () {
        $('#reasonModal').removeClass('show');
        $('#presentReason').val('');
        currentPresentStudentId = null;
        currentAttendanceAction = null;
    });

    // Close reason modal when clicking outside
    $('#reasonModal').on('click', function (e) {
        if ($(e.target).is('#reasonModal')) {
            $('#reasonModal').removeClass('show');
            $('#presentReason').val('');
            currentPresentStudentId = null;
            currentAttendanceAction = null;
        }
    });

    // Confirm attendance with reason (for both present and absent)
    $('#confirmAttendance').on('click', function () {
        if (currentPresentStudentId && currentAttendanceAction) {
            var reason = $('#presentReason').val().trim();
            var item = $('.attendance-item[data-id="' + currentPresentStudentId + '"]');

            if (currentAttendanceAction === 'present') {
                presentReasons[currentPresentStudentId] = reason;
                attendanceData[currentPresentStudentId] = 'present';

                item.find('.present-btn').addClass('active');
                item.find('.absent-btn').removeClass('active');
            } else if (currentAttendanceAction === 'absent') {
                absentReasons[currentPresentStudentId] = reason;
                attendanceData[currentPresentStudentId] = 'absent';

                item.find('.present-btn').removeClass('active');
                item.find('.absent-btn').addClass('active');
            }

            updateAttendanceSummary();

            $('#reasonModal').removeClass('show');
            $('#presentReason').val('');
            currentPresentStudentId = null;
            currentAttendanceAction = null;
        }
    });

    // Use students data from server (passed via template data attribute)
    var studentsDataElement = document.getElementById('students-data');
    var serverStudents = studentsDataElement ? JSON.parse(studentsDataElement.textContent || '[]') : [];
    var students = serverStudents || [];
    
    // Transform students to ensure they have id property = enrollment
    students = students.map(function(s) {
        return {
            id: s.enrollment || s.id,
            enrollment: s.enrollment,
            name: s.name,
            batch: s.batch,
            email: s.email,
            department: s.department,
            phone: s.phone_no,
            address: s.address
        };
    });

    // Attendance tracking
    var attendanceData = {};

    // Initialize attendance data
    students.forEach(function (student) {
        attendanceData[student.id] = 'present';
    });

    // Set today's date as default
    var today = new Date().toISOString().split('T')[0];
    $('#attendanceDate').val(today);

    // Render students grid
    function renderStudents(studentList) {
        var grid = $('#studentsGrid');
        grid.empty();

        if (studentList.length === 0) {
            grid.html('<div class="no-students" style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">No students found</div>');
            return;
        }

        studentList.forEach(function (student) {
            var attendanceClass = student.attendance >= 90 ? 'good' : (student.attendance >= 75 ? 'warning' : 'danger');

            var card = $('<div class="student-card" data-id="' + student.id + '">');
            card.html(`
                <div class="student-card-header">
                    <div class="student-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div class="student-name">${student.name}</div>
                        <div class="student-id">${student.id}</div>
                    </div>
                </div>
                <div class="student-details">
                    <div class="detail-item">
                        <span class="label">Batch</span>
                        <span class="value">${student.batch || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Email</span>
                        <span class="value">${student.email || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Department</span>
                        <span class="value">${student.department || 'N/A'}</span>
                    </div>
                </div>
            `);

            card.on('click', function () {
                showStudentModal(student);
            });

            grid.append(card);
        });
    }

    // Render attendance list
    function renderAttendanceList() {
        var list = $('#attendanceList');
        list.empty();

        students.forEach(function (student) {
            var status = attendanceData[student.id] || 'present';

            var item = $('<div class="attendance-item" data-id="' + student.id + '">');
            item.html(`
                <div class="student-info">
                    <div class="avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="details">
                        <span class="name">${student.name}</span>
                        <span class="id">${student.id}</span>
                    </div>
                </div>
                <div class="attendance-actions">
                    <button class="present-btn ${status === 'present' ? 'active' : ''}" data-status="present">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="absent-btn ${status === 'absent' ? 'active' : ''}" data-status="absent">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `);

            list.append(item);
        });

        updateAttendanceSummary();
    }

    // Update attendance summary
    function updateAttendanceSummary() {
        var present = 0;
        var absent = 0;

        students.forEach(function (student) {
            if (attendanceData[student.id] === 'present') {
                present++;
            } else {
                absent++;
            }
        });

        $('#presentCount').text(present);
        $('#absentCount').text(absent);
        $('#totalStudents').text(students.length);

        var percentage = students.length > 0 ? Math.round((present / students.length) * 100) : 0;
        $('#attendancePercentage').text(percentage + '%');
    }

    // Render records table
    function renderRecords(records) {
        var tbody = $('#recordsTableBody');
        tbody.empty();

        if (records.length === 0) {
            tbody.html('<tr><td colspan="7" style="text-align: center; padding: 40px;">No records found</td></tr>');
            return;
        }

        records.forEach(function (student) {
            var attendanceClass = student.attendance >= 90 ? 'good' : (student.attendance >= 75 ? 'warning' : 'danger');

            var row = $('<tr>');
            row.html(`
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.present}</td>
                <td><span class="attendance-badge ${attendanceClass}">${student.attendance}%</span></td>
                <td>
                    <button class="view-btn" data-id="${student.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `);

            tbody.append(row);
        });
    }

    // Load student attendance from API
    function loadStudentAttendance() {
        $.ajax({
            url: '/get_mentor_student_attendance',
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    // Update the global students array with real attendance data
                    students = response.students || [];
                    // Render the records with real data
                    renderRecords(students);
                } else {
                    console.error('Failed to load attendance:', response.message);
                    // Fallback to empty table
                    renderRecords([]);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading attendance:', error);
                renderRecords([]);
            }
        });
    }

    // Show student modal
    function showStudentModal(student) {
        var modal = $('#studentModal');
        var body = $('#modalBody');

        // Show loading first
        body.html('<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>');
        modal.addClass('show');

        // Fetch attendance data for this specific student
        $.ajax({
            url: '/get_student_attendance_details',
            method: 'GET',
            data: { enrollment: student.id || student.enrollment },
            success: function(response) {
                var attendanceData = response.success ? response : {
                    present: student.present || 0,
                    absent: student.absent || 0,
                    attendance: student.attendance || 0
                };
                
                var attendanceClass = attendanceData.attendance >= 90 ? 'good' : (attendanceData.attendance >= 75 ? 'warning' : 'danger');

                body.html(`
                    <div class="modal-student-info">
                        <div class="avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="student-details">
                        <h3>${student.name}</h3>
                        <p>${student.id || student.enrollment}</p>
                        </div>
                    </div>
                    <div class="modal-details">
                        <div class="modal-detail-row">
                            <span class="label">Email</span>
                            <span class="value">${student.email || 'N/A'}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Phone</span>
                            <span class="value">${student.phone || 'N/A'}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Batch</span>
                            <span class="value">${student.batch || student.class || 'N/A'}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Lectures Present</span>
                            <span class="value">${attendanceData.present}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Total Lectures</span>
                            <span class="value">${attendanceData.total_lectures || 104}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Attendance</span>
                            <span class="attendance-badge ${attendanceClass}">${attendanceData.attendance}%</span>
                        </div>
                        ${attendanceData.month ? `<div class="modal-detail-row">
                            <span class="label">Month</span>
                            <span class="value">${attendanceData.month}</span>
                        </div>` : ''}
                    </div>
                `);
            },
            error: function() {
                // Fallback to local data
                var attendanceClass = student.attendance >= 90 ? 'good' : (student.attendance >= 75 ? 'warning' : 'danger');
                
                body.html(`
                    <div class="modal-student-info">
                        <div class="avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="student-details">
                        <h3>${student.name}</h3>
                        <p>${student.id || student.enrollment}</p>
                        </div>
                    </div>
                    <div class="modal-details">
                        <div class="modal-detail-row">
                            <span class="label">Email</span>
                            <span class="value">${student.email || 'N/A'}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Phone</span>
                            <span class="value">${student.phone || 'N/A'}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Batch</span>
                            <span class="value">${student.batch || student.class || 'N/A'}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Lectures Present</span>
                            <span class="value">${student.present || 0}</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Total Lectures</span>
                            <span class="value">104</span>
                        </div>
                        <div class="modal-detail-row">
                            <span class="label">Attendance</span>
                            <span class="attendance-badge ${attendanceClass}">${student.attendance || 0}%</span>
                        </div>
                    </div>
                `);
            }
        });
    }

    // Search and filter students
    $('#studentSearch').on('input', function () {
        var searchTerm = $(this).val().toLowerCase();
        var batchFilter = $('#batchFilter').val();

        var filtered = students.filter(function (student) {
            var matchesSearch = student.name.toLowerCase().includes(searchTerm) ||
                student.id.toLowerCase().includes(searchTerm);
            var matchesBatch = !batchFilter || student.batch === batchFilter;
            return matchesSearch && matchesBatch;
        });

        renderStudents(filtered);
    });

    $('#batchFilter').on('change', function () {
        var searchTerm = $('#studentSearch').val().toLowerCase();
        var batchFilter = $(this).val();

        var filtered = students.filter(function (student) {
            var matchesSearch = student.name.toLowerCase().includes(searchTerm) ||
                student.id.toLowerCase().includes(searchTerm);
            var matchesBatch = !batchFilter || student.batch === batchFilter;
            return matchesSearch && matchesBatch;
        });

        renderStudents(filtered);
    });

    // Search and filter records
    $('#recordsSearch').on('input', function () {
        var searchTerm = $(this).val().toLowerCase();
        var batchFilter = $('#recordsBatchFilter').val();
        var sortBy = $('#recordsSort').val();

        var filtered = students.filter(function (student) {
            var matchesSearch = student.name.toLowerCase().includes(searchTerm) ||
                student.id.toLowerCase().includes(searchTerm);
            var matchesBatch = !batchFilter || student.batch === batchFilter;
            return matchesSearch && matchesBatch;
        });

        // Sort
        filtered.sort(function (a, b) {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'attendance') {
                return b.attendance - a.attendance;
            } else if (sortBy === 'id') {
                return a.id.localeCompare(b.id);
            }
            return 0;
        });

        renderRecords(filtered);
    });

    $('#recordsBatchFilter, #recordsSort').on('change', function () {
        $('#recordsSearch').trigger('input');
    });

    // Mark all present
    $('#markAllPresent').on('click', function () {
        students.forEach(function (student) {
            attendanceData[student.id] = 'present';
        });
        renderAttendanceList();
    });

    // Save attendance
    $('#saveAttendance').on('click', function () {
        var date = $('#attendanceDate').val();
        var lecture = $('#lectureSelect').val();

        // Store attendance data
        var savedData = JSON.parse(localStorage.getItem('attendanceData') || '{}');

        students.forEach(function (student) {
            if (!savedData[date]) {
                savedData[date] = {};
            }
            var status = attendanceData[student.id];
            var reason = status === 'present' ? (presentReasons[student.id] || '') : (absentReasons[student.id] || '');
            savedData[date][student.id] = {
                status: status,
                reason: reason
            };
        });

        localStorage.setItem('attendanceData', JSON.stringify(savedData));

        alert('Attendance saved successfully for ' + date + ' (Lecture ' + lecture + ')');
    });

    // Attendance button clicks
    $('body').on('click', '.present-btn', function () {
        var item = $(this).closest('.attendance-item');
        var studentId = item.data('id');
        var student = students.find(function (s) {
            return s.id === studentId;
        });

        // Store current student and action
        currentPresentStudentId = studentId;
        currentAttendanceAction = 'present';

        // Set modal title and labels for present
        $('#reasonModalTitle').text('Mark Student Present');
        $('#reasonLabel').text('Reason for Marking Present (Optional)');
        $('#presentReason').attr('placeholder', 'Enter reason (e.g., Late arrival, Medical reason, etc.)');
        $('#confirmAttendance').text('Confirm Present');

        // Set student info in modal
        $('#reasonStudentInfo').html(`
        <div class="avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="student-details">
            <h3>${student.name}</h3>
            <p>${student.id}</p>
        </div>
    `);

        $('#presentReason').val('');
        $('#reasonModal').addClass('show');
    });


    $('body').on('click', '.absent-btn', function () {
        var item = $(this).closest('.attendance-item');
        var studentId = item.data('id');
        var student = students.find(function (s) {
            return s.id === studentId;
        });

        // Store current student and action
        currentPresentStudentId = studentId;
        currentAttendanceAction = 'absent';

        // Set modal title and labels for absent
        $('#reasonModalTitle').text('Mark Student Absent');
        $('#reasonLabel').text('Reason for Marking Absent (Optional)');
        $('#presentReason').attr('placeholder', 'Enter reason (e.g., No permission, Sick leave, etc.)');
        $('#confirmAttendance').text('Confirm Absent');

        // Set student info in modal
        $('#reasonStudentInfo').html(`
        <div class="avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="student-details">
            <h3>${student.name}</h3>
            <p>${student.id}</p>
        </div>
    `);

        $('#presentReason').val('');
        $('#reasonModal').addClass('show');
    });

    // View button click
    $('body').on('click', '.view-btn', function () {
        var studentId = $(this).data('id');
        var student = students.find(function (s) { return s.id === studentId; });
        if (student) {
            showStudentModal(student);
        }
    });

    // Edit button click
    $('body').on('click', '.edit-btn', function () {
        var studentId = $(this).data('id');
        alert('Edit functionality for student: ' + studentId);
    });

    // Export records
    $('#exportRecords').on('click', function () {
        var csv = 'Student ID,Name,Batch,Present,Absent,Attendance %\n';

        students.forEach(function (student) {
            csv += student.id + ',' + student.name + ',' + student.batch + ',' +
                student.present + ',' + student.absent + ',' + student.attendance + '%\n';
        });

        var blob = new Blob([csv], { type: 'text/csv' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'student_records.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    });

    // Load students on page load
    renderStudents(students);

    // Load attendance list
    renderAttendanceList();

    // Load records
    renderRecords(students);

    // ==============================
    // Face ID Management
    // ==============================
    var faceIdData = {}; // Will be populated from database
    var capturedImages = []; // Array to store multiple images (min 2, max 5)
    var currentEditingStudentId = null;
    var MIN_FACE_IMAGES = 2; // Minimum required images for better face recognition
    var MAX_FACE_IMAGES = 5; // Maximum allowed images

    // Load face IDs from database on page load
    function loadFaceIdsFromDatabase() {
        $.ajax({
            url: '/get_faceids',
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    // Convert array to object with enrollment as key
                    faceIdData = {};
                    response.face_ids.forEach(function(item) {
                        faceIdData[item.enrollment] = { count: item.image_count, images: [] };
                    });
                    populateFaceIdStudentSelect();
                    renderFaceIdList();
                }
            },
            error: function() {
                console.error('Failed to load face IDs from database');
            }
        });
    }

    // Initialize face ID data on page load
    loadFaceIdsFromDatabase();

    // Populate student select dropdown
    function populateFaceIdStudentSelect() {
        var select = $('#faceidStudentSelect');
        select.empty();
        select.append('<option value="">Choose a student...</option>');

        students.forEach(function (student) {
            // Check if student already has face ID registered
            var hasFaceId = faceIdData[student.id] && faceIdData[student.id].count > 0;
            
            // Skip students who already have face IDs (optional: remove this to allow re-registration)
            if (hasFaceId) {
                return; // Skip this student
            }
            
            select.append('<option value="' + student.id + '">' + student.name + ' - ' + student.id + '</option>');
        });
    }

    // Render face ID list
    function renderFaceIdList() {
        var list = $('#faceidList');
        list.empty();

        var registeredStudents = students.filter(function (s) {
            return faceIdData[s.id] && faceIdData[s.id].count > 0;
        });

        if (registeredStudents.length === 0) {
            list.html(`
            <div class="no-faceid">
                <i class="fas fa-id-card"></i>
                <p>No face IDs registered yet</p>
            </div>
        `);
            return;
        }

        registeredStudents.forEach(function (student) {
            var data = faceIdData[student.id] || { count: 0, images: [] };
            var images = data.images || [];
            var imageCount = data.count || 0;
            
            // Show first image as avatar, indicate total count
            var avatarHtml = imageCount > 0 
                ? `<i class="fas fa-user"></i>` 
                : `<i class="fas fa-user"></i>`;

            var item = $(`
            <div class="faceid-item" data-id="${student.id}">
                <div class="faceid-item-avatar">
                    ${avatarHtml}
                    ${imageCount > 1 ? `<span class="image-count-badge">${imageCount}</span>` : ''}
                </div>
                <div class="faceid-item-info">
                    <div class="faceid-item-name">${student.name}</div>
                    <div class="faceid-item-id">${student.id}</div>
                    <div class="faceid-item-images">${imageCount}/${MAX_FACE_IMAGES} images</div>
                </div>
                <div class="faceid-item-status ${imageCount >= MIN_FACE_IMAGES ? 'registered' : 'incomplete'}">
                    <i class="fas fa-${imageCount >= MIN_FACE_IMAGES ? 'check' : 'exclamation'}-circle"></i> 
                    ${imageCount >= MIN_FACE_IMAGES ? 'Registered' : 'Incomplete (' + MIN_FACE_IMAGES + ' min)'}
                </div>
                <div class="faceid-item-actions">
                    <button class="faceid-action-btn view-images" 
                            data-id="${student.id}"
                            title="View All Images">
                        <i class="fas fa-images"></i>
                    </button>
                    <button class="faceid-action-btn delete"
                            data-id="${student.id}"
                            title="Delete Face ID">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `);

            list.append(item);
        });
    }


    // Search face ID list
    $('#faceidSearch').on('input', function () {
        var searchTerm = $(this).val().toLowerCase();
        var list = $('#faceidList');

        $('.faceid-item').each(function () {
            var name = $(this).find('.faceid-item-name').text().toLowerCase();
            var id = $(this).find('.faceid-item-id').text().toLowerCase();

            if (name.includes(searchTerm) || id.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });

    // Delete face ID
    $('body').on('click', '.faceid-action-btn.delete', function () {
        var studentId = $(this).data('id');
        var student = students.find(function (s) { return s.id === studentId; });

        if (confirm('Are you sure you want to delete all Face ID images for ' + student.name + '?')) {
            $.ajax({
                url: '/delete_faceid/' + studentId,
                method: 'DELETE',
                success: function(response) {
                    if (response.success) {
                        delete faceIdData[studentId];
                        renderFaceIdList();
                        populateFaceIdStudentSelect();
                        alert('Face ID deleted successfully');
                    } else {
                        alert('Error: ' + response.message);
                    }
                },
                error: function() {
                    alert('Failed to delete face ID');
                }
            });
        }
    });

    // View all images for a student
    $('body').on('click', '.faceid-action-btn.view-images', function () {
        var studentId = $(this).data('id');
        var student = students.find(function (s) { return s.id === studentId; });

        // Show loading state
        $('#viewImagesContent').html('<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading images...</div>');
        $('#viewImagesStudentName').text(student.name + ' - ' + student.id);
        $('#viewImagesModal').addClass('show');

        // Fetch images from database
        $.ajax({
            url: '/get_faceid_images/' + studentId,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    var imagesHtml = response.images.map(function (img, index) {
                        return `<div class="view-image-item">
                            <img src="${img.image}" alt="Face ${index + 1}">
                            <span>Image ${index + 1}</span>
                        </div>`;
                    }).join('');

                    $('#viewImagesContent').html(`
                        <div class="view-images-grid">${imagesHtml}</div>
                    `);
                } else {
                    $('#viewImagesContent').html('<div style="text-align: center; padding: 20px; color: red;">Error loading images</div>');
                }
            },
            error: function() {
                $('#viewImagesContent').html('<div style="text-align: center; padding: 20px; color: red;">Failed to load images</div>');
            }
        });
    });

    // Close view images modal
    $('#closeViewImagesModal, #closeViewImagesBtn').on('click', function () {
        $('#viewImagesModal').removeClass('show');
    });

    $('#viewImagesModal').on('click', function (e) {
        if ($(e.target).is('#viewImagesModal')) {
            $('#viewImagesModal').removeClass('show');
        }
    });

    // Update the captured images preview
    function updateCapturedImagesPreview() {
        var previewContainer = $('#capturedImagesContainer');
        previewContainer.empty();

        capturedImages.forEach(function (img, index) {
            var imgItem = $(`
                <div class="captured-image-item" data-index="${index}">
                    <img src="${img}" alt="Captured ${index + 1}">
                    <button class="remove-image-btn" data-index="${index}" title="Remove this image">
                        <i class="fas fa-times"></i>
                    </button>
                    <span class="image-number">${index + 1}</span>
                </div>
            `);
            previewContainer.append(imgItem);
        });

        // Update counter
        $('#imageCount').text(capturedImages.length + '/' + MAX_FACE_IMAGES);
        $('#imageCount').attr('class', 'image-count ' + (capturedImages.length >= MIN_FACE_IMAGES ? 'sufficient' : 'insufficient'));

        // Show preview if we have images
        if (capturedImages.length > 0) {
            $('#capturedPreview').show();
        } else {
            $('#capturedPreview').hide();
        }

        // Update save button state
        $('#saveFaceId').prop('disabled', capturedImages.length < MIN_FACE_IMAGES);

        // Show warning if below minimum
        if (capturedImages.length < MIN_FACE_IMAGES) {
            $('#minImagesWarning').show();
        } else {
            $('#minImagesWarning').hide();
        }
    }

    // Remove captured image
    $('body').on('click', '.remove-image-btn', function () {
        var index = $(this).data('index');
        capturedImages.splice(index, 1);
        updateCapturedImagesPreview();
    });

    // Clear all captured images
    $('#clearCapturedImages').on('click', function () {
        capturedImages = [];
        updateCapturedImagesPreview();
    });

    // Save face ID
    $('#saveFaceId').on('click', function () {
        var studentId = $('#faceidStudentSelect').val();

        if (!studentId) {
            alert('Please select a student');
            return;
        }

        if (capturedImages.length < MIN_FACE_IMAGES) {
            alert('Please add at least ' + MIN_FACE_IMAGES + ' images for better face recognition. Current: ' + capturedImages.length);
            return;
        }

        if (capturedImages.length > MAX_FACE_IMAGES) {
            alert('Maximum ' + MAX_FACE_IMAGES + ' images allowed');
            return;
        }

        var student = students.find(function (s) { return s.id === studentId; });

        // Create FormData and send to backend
        var formData = new FormData();
        formData.append('enrollment', studentId);

        // Convert base64 images to blob and append to form data
        capturedImages.forEach(function(base64Image, index) {
            // Convert base64 to blob
            var byteCharacters = atob(base64Image.split(',')[1]);
            var byteNumbers = new Array(byteCharacters.length);
            for (var i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            var blob = new Blob([byteArray], {type: 'image/jpeg'});
            formData.append('images', blob, 'face_' + index + '.jpg');
        });

        // Disable button to prevent double submit
        $('#saveFaceId').prop('disabled', true).text('Saving...');

        $.ajax({
            url: '/save_faceid',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    // Store the count BEFORE resetting
                    var savedCount = capturedImages.length;
                    
                    // Update local data
                    faceIdData[studentId] = { count: savedCount, images: capturedImages };
                    
                    // Reset UI
                    $('#faceidStudentSelect').val('');
                    capturedImages = [];
                    updateCapturedImagesPreview();

                    // Refresh lists
                    renderFaceIdList();
                    populateFaceIdStudentSelect();

                    alert('Face ID registered successfully for ' + student.name + ' with ' + savedCount + ' images');
                } else {
                    alert('Error: ' + response.message);
                }
            },
            error: function(xhr) {
                var errorMsg = 'Failed to save face ID';
                try {
                    var response = JSON.parse(xhr.responseText);
                    errorMsg = response.message || errorMsg;
                } catch(e) {}
                alert(errorMsg);
            },
            complete: function() {
                $('#saveFaceId').prop('disabled', false).html('<i class="fas fa-save"></i> Save Face ID');
            }
        });
    });

    // Handle file upload - simplified
    $('#faceImageUpload').on('change', function(e) {
        var files = e.target.files;
        
        if (!files || files.length === 0) {
            return;
        }

        // Check if adding these images would exceed the max
        if (capturedImages.length + files.length > MAX_FACE_IMAGES) {
            alert('You can only add ' + (MAX_FACE_IMAGES - capturedImages.length) + ' more image(s). Maximum is ' + MAX_FACE_IMAGES + '.');
            return;
        }

        var processedCount = 0;
        var validFiles = 0;
        var totalFiles = files.length;

        Array.from(files).forEach(function(file) {
            // Validate file type
            if (!file.type.match('image.*')) {
                processedCount++;
                if (processedCount === totalFiles && validFiles === 0) {
                    alert('Please select valid image files (JPG, PNG)');
                }
                return;
            }

            var reader = new FileReader();
            reader.onload = function(event) {
                capturedImages.push(event.target.result);
                validFiles++;
                processedCount++;

                if (processedCount === totalFiles) {
                    updateCapturedImagesPreview();

                    // Reset file input after all images are processed
                    $('#faceImageUpload').val('');
                }
            };
            reader.readAsDataURL(file);
        });
    });

    // ===========================================
    // Bulk Student Upload (CSV/Excel) Functionality
    // ===========================================
    
    var selectedStudentFile = null;
    
    // Handle file selection
    $('#studentFileUpload').on('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        // Validate file type
        var validTypes = ['.csv', '.xlsx', '.xls'];
        var fileName = file.name.toLowerCase();
        var isValid = validTypes.some(function(ext) {
            return fileName.endsWith(ext);
        });
        
        if (!isValid) {
            showUploadStatus('Please select a valid CSV or Excel file', 'error');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showUploadStatus('File size exceeds 5MB limit', 'error');
            return;
        }
        
        selectedStudentFile = file;
        
        // Show file preview
        $('#fileName').text(file.name);
        $('#fileSize').text(formatFileSize(file.size));
        $('#filePreview').show();
        $('#uploadStudents').prop('disabled', false);
    });
    
    // Handle remove file
    $('#removeFile').on('click', function() {
        selectedStudentFile = null;
        $('#studentFileUpload').val('');
        $('#filePreview').hide();
        $('#uploadStudents').prop('disabled', true);
        $('#uploadStatus').hide();
    });
    
    // Handle upload students
    $('#uploadStudents').on('click', function() {
        if (!selectedStudentFile) return;
        
        // Show loading state
        $('#uploadStudents').prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Uploading...');
        
        var formData = new FormData();
        formData.append('batch_excel_file', selectedStudentFile);
        
        $.ajax({
            url: '/mentor_upload_students',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    showUploadStatus(response.message, 'success');
                    
                    // Change button to success state
                    $('#uploadStudents')
                        .removeClass('upload-students-btn')
                        .addClass('upload-success-btn')
                        .html('<i class="fas fa-check"></i> Uploaded')
                        .css('background-color', '#28a745')
                        .css('border-color', '#28a745');
                    
                    // Refresh student lists
                    populateStudentsGrid();
                    populateFaceIdStudentSelect();
                    renderFaceIdList();
                    
                    // Reset file input
                    selectedStudentFile = null;
                    $('#studentFileUpload').val('');
                    $('#filePreview').hide();
                    $('#uploadStudents').prop('disabled', true);
                } else {
                    showUploadStatus(response.message, 'error');
                    $('#uploadStudents').prop('disabled', false).html('<i class="fas fa-upload"></i> Upload Students');
                }
            },
            error: function(xhr, status, error) {
                showUploadStatus('Error uploading file: ' + error, 'error');
                $('#uploadStudents').prop('disabled', false).html('<i class="fas fa-upload"></i> Upload Students');
            }
        });
    });
    
    // Download template - use backend endpoint
    $('#downloadTemplate').on('click', function() {
        window.location.href = '/download_template';
    });
    
    // Parse CSV data
    function parseCSVData(csvText) {
        var lines = csvText.split('\n');
        var students = [];
        
        // Skip header row
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            
            var parts = line.split(',');
            if (parts.length >= 2) {
                students.push({
                    id: parts[0].trim(),
                    name: parts[1].trim(),
                    batch: parts[2] ? parts[2].trim() : '',
                    email: parts[3] ? parts[3].trim() : '',
                    phone: parts[4] ? parts[4].trim() : ''
                });
            }
        }
        
        return students;
    }
    
    // Parse Excel data using SheetJS library
    function parseExcelData(arrayBuffer) {
        try {
            var data = new Uint8Array(arrayBuffer);
            var workbook = XLSX.read(data, { type: 'array' });
            var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            var students = [];
            
            // Skip header row
            for (var i = 1; i < jsonData.length; i++) {
                var row = jsonData[i];
                if (row && row.length >= 2) {
                    students.push({
                        id: String(row[0]).trim(),
                        name: String(row[1]).trim(),
                        batch: row[2] ? String(row[2]).trim() : '',
                        email: row[3] ? String(row[3]).trim() : '',
                        phone: row[4] ? String(row[4]).trim() : ''
                    });
                }
            }
            
            return students;
        } catch (error) {
            console.error('Excel parsing error:', error);
            return [];
        }
    }
    
    // Show upload status
    function showUploadStatus(message, type) {
        var statusDiv = $('#uploadStatus');
        var messageDiv = $('#statusMessage');
        
        statusDiv.removeClass('success error');
        statusDiv.addClass(type);
        
        messageDiv.removeClass('error');
        if (type === 'error') {
            messageDiv.addClass('error');
            messageDiv.html('<i class="fas fa-exclamation-circle"></i><span>' + message + '</span>');
        } else {
            messageDiv.html('<i class="fas fa-check-circle"></i><span>' + message + '</span>');
        }
        
        statusDiv.show();
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Initialize face ID section
    populateFaceIdStudentSelect();
    renderFaceIdList();
});

