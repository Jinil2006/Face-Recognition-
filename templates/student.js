$(document).ready(function () {

    /* =====================
       LOAD ATTENDANCE DATA
    ===================== */
    function loadAttendanceData() {
        $.ajax({
            url: '/get_student_attendance',
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    const data = response.data;
                    
                    // Update stats
                    $('#presentCount').text(data.present || 0);
                    $('#absentCount').text(data.absent || 0);
                    $('#totalLectures').text(data.total || 104);
                    
                    // Display percentage with up to 2 decimal places
                    const percentage = data.percentage || 0;
                    const formattedPercent = percentage % 1 === 0 ? percentage.toString() : percentage.toFixed(2);
                    $('#attendancePercent').text(formattedPercent + '%');
                }
            },
            error: function() {
                console.error('Failed to load attendance data');
            }
        });
        
        // Load attendance records
        loadAttendanceRecords();
    }
    
    function loadAttendanceRecords() {
        $.ajax({
            url: '/get_student_attendance_records',
            method: 'GET',
            success: function(response) {
                const container = $('#attendanceRecords');
                container.empty();
                
                if (response.success && response.records && response.records.length > 0) {
                    response.records.forEach(function(record) {
                        const statusClass = record.status === 'Present' ? 'present' : 'absent';
                        const recordHtml = '<div class="record-item">' +
                            '<div class="record-info">' +
                                '<span class="record-date">' + record.date + '</span>' +
                                '<span class="record-lecture">Lecture ' + record.lecture + '</span>' +
                            '</div>' +
                            '<span class="record-status ' + statusClass + '">' + record.status + '</span>' +
                        '</div>';
                        container.append(recordHtml);
                    });
                } else {
                    container.html('<p class="no-data">No attendance records found</p>');
                }
            },
            error: function() {
                $('#attendanceRecords').html('<p class="no-data">Failed to load attendance records</p>');
            }
        });
    }
    
    // Load attendance on page load
    loadAttendanceData();

    /* =====================
       THEME TOGGLE
    ===================== */
    let isLight = false;

    function updateThemeIcons() {
        const iconClass = isLight ? 'fa-moon' : 'fa-sun';
        $('.theme-toggle i, .mobile-theme-toggle i')
            .removeClass('fa-moon fa-sun')
            .addClass(iconClass);
    }

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        isLight = true;
        $('body').addClass('light-theme');
        updateThemeIcons();
    }

    // Toggle theme
    $('body').on('click', '.theme-toggle, .mobile-theme-toggle', function (e) {
        e.preventDefault();
        isLight = !isLight;
        $('body').toggleClass('light-theme', isLight);
        updateThemeIcons();
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });


    /* =====================
       SIDEBAR (MOBILE)
    ===================== */
    $('#hamburgerMenu').on('click', function () {
        $('#sidebar').toggleClass('mobile-open');
        $('#sidebarOverlay').toggleClass('show');
        $(this).find('i').toggleClass('fa-bars fa-times');
    });

    $('#sidebarOverlay').on('click', function () {
        closeSidebar();
    });

    function closeSidebar() {
        $('#sidebar').removeClass('mobile-open');
        $('#sidebarOverlay').removeClass('show');
        $('#hamburgerMenu i').removeClass('fa-times').addClass('fa-bars');
    }


    /* =====================
       TAB NAVIGATION
    ===================== */
    $('.sidebar-nav .nav-item').on('click', function (e) {
        if ($(this).hasClass('logout')) return;

        e.preventDefault();

        const tabId = $(this).data('tab');
        if (!tabId) return;

        $('.nav-item').removeClass('active');
        $(this).addClass('active');

        $('.tab-content').removeClass('active');
        $('#' + tabId).addClass('active');

        closeSidebar(); // auto close on mobile
    });

});
