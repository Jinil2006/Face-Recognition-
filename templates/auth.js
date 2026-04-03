$(document).ready(function () {

    /* =========================
       Theme Toggle
    ========================= */
    let isLight = false;

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            isLight = true;
            $('body').addClass('light-theme');
            $('#themeToggle i').removeClass('fa-moon').addClass('fa-sun');
        }
    }

    initTheme();

    $('#themeToggle').on('click', function () {
        isLight = !isLight;
        $('body').toggleClass('light-theme', isLight);
        $(this).find('i')
            .toggleClass('fa-moon', !isLight)
            .toggleClass('fa-sun', isLight);
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    /* =========================
       Password Show / Hide
    ========================= */
    $(document).on('click', '.toggle-password', function () {
        const target = $(this).data('target');
        const input = $('#' + target);

        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            $(this).removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            input.attr('type', 'password');
            $(this).removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });

    /* =========================
       Password Strength Meter
    ========================= */
    function calculatePasswordStrength(password) {
        let score = 0;
        if (!password) return 0;

        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 10;
        if (/[a-z]/.test(password)) score += 15;
        if (/[A-Z]/.test(password)) score += 15;
        if (/[0-9]/.test(password)) score += 20;
        if (/[@$!%*?&]/.test(password)) score += 20;

        return Math.min(score, 100);
    }

    $('#password, #newPassword').on('input', function () {
        const password = $(this).val();
        const strengthBar = $(this).closest('.form-group').find('.strength-bar');
        const strengthBox = $(this).closest('.form-group').find('.password-strength');

        if (!password) {
            strengthBox.removeClass('show');
            strengthBar.removeClass('weak medium strong');
            return;
        }

        strengthBox.addClass('show');
        const strength = calculatePasswordStrength(password);
        strengthBar.removeClass('weak medium strong');

        if (strength < 40) {
            strengthBar.addClass('weak');
        } else if (strength < 70) {
            strengthBar.addClass('medium');
        } else {
            strengthBar.addClass('strong');
        }
    });

    /* =========================
       UI Error Clear (NO SUBMIT BLOCK)
    ========================= */
    $('#userId, #password, #confirmPassword, #email, #otp, #newPassword, #confirmNewPassword')
        .on('input', function () {
            $(this).removeClass('error');
            $('#' + this.id + 'Error').removeClass('show');
            $('#errorMessage').removeClass('show');
        });

});
