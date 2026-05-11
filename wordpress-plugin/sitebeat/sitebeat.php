<?php
/**
 * Plugin Name: Sitebeat — SEO Audit & Weekly Monitoring
 * Plugin URI: https://sitebeat.tech
 * Description: Run a free 13-point SEO audit on this WordPress site directly from the dashboard. Subscribe for automated weekly monitoring with email alerts on regressions.
 * Version: 1.0.0
 * Author: Sitebeat
 * Author URI: https://sitebeat.tech
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: sitebeat
 *
 * Copyright (C) 2026 Sitebeat
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, version 2, as published by the
 * Free Software Foundation.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SITEBEAT_VERSION', '1.0.0');
define('SITEBEAT_BASE_URL', 'https://sitebeat.tech');

class Sitebeat_Plugin {
    public function __construct() {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    public function register_menu() {
        add_menu_page(
            __('Sitebeat SEO', 'sitebeat'),
            __('Sitebeat SEO', 'sitebeat'),
            'manage_options',
            'sitebeat',
            [$this, 'render_dashboard'],
            'dashicons-chart-line',
            80
        );
    }

    public function register_settings() {
        register_setting('sitebeat_settings', 'sitebeat_last_audit_id');
        register_setting('sitebeat_settings', 'sitebeat_last_score');
        register_setting('sitebeat_settings', 'sitebeat_last_run_at');
    }

    public function render_dashboard() {
        $site_url = home_url('/');
        $admin_email = get_option('admin_email');
        $last_audit_id = get_option('sitebeat_last_audit_id');
        $last_score = get_option('sitebeat_last_score');
        $last_run = get_option('sitebeat_last_run_at');

        // Handle "Run audit" submission.
        if (isset($_POST['sitebeat_run']) && check_admin_referer('sitebeat_run_audit')) {
            $result = $this->run_audit($site_url, $admin_email);
            if (is_wp_error($result)) {
                echo '<div class="notice notice-error"><p>' . esc_html($result->get_error_message()) . '</p></div>';
            } else {
                update_option('sitebeat_last_audit_id', $result['auditId']);
                update_option('sitebeat_last_run_at', current_time('mysql'));
                $last_audit_id = $result['auditId'];
                $last_run = current_time('mysql');
                echo '<div class="notice notice-success"><p>' .
                    sprintf(
                        /* translators: %s = audit URL */
                        esc_html__('Audit started — view results at %s', 'sitebeat'),
                        '<a href="' . esc_url(SITEBEAT_BASE_URL . '/audit/' . $result['auditId']) . '" target="_blank">' .
                        esc_html(SITEBEAT_BASE_URL . '/audit/' . $result['auditId']) . '</a>'
                    ) .
                    '</p></div>';
            }
        }

        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Sitebeat SEO Audit', 'sitebeat'); ?></h1>
            <p>
                <?php esc_html_e(
                    'Run a free 13-point SEO audit on your live site. The audit checks HTTPS, meta description, headings, page speed, sitemap, robots.txt, canonical, viewport, alt text, Open Graph, broken links, and structured data.',
                    'sitebeat'
                ); ?>
            </p>

            <div style="background:#fff;border:1px solid #ccd0d4;border-radius:6px;padding:24px;margin-top:20px;max-width:720px;">
                <h2 style="margin-top:0;"><?php esc_html_e('Run audit on this site', 'sitebeat'); ?></h2>
                <p>
                    <strong><?php esc_html_e('URL:', 'sitebeat'); ?></strong> <?php echo esc_html($site_url); ?><br>
                    <strong><?php esc_html_e('Report email:', 'sitebeat'); ?></strong> <?php echo esc_html($admin_email); ?>
                </p>
                <form method="post">
                    <?php wp_nonce_field('sitebeat_run_audit'); ?>
                    <p><button type="submit" name="sitebeat_run" class="button button-primary button-large">
                        <?php esc_html_e('Run free audit now', 'sitebeat'); ?>
                    </button></p>
                </form>

                <?php if ($last_audit_id): ?>
                    <hr style="margin:24px 0;">
                    <h3><?php esc_html_e('Last audit', 'sitebeat'); ?></h3>
                    <p>
                        <strong><?php esc_html_e('Run at:', 'sitebeat'); ?></strong> <?php echo esc_html($last_run); ?><br>
                        <a class="button" href="<?php echo esc_url(SITEBEAT_BASE_URL . '/audit/' . $last_audit_id); ?>" target="_blank">
                            <?php esc_html_e('View report on Sitebeat →', 'sitebeat'); ?>
                        </a>
                    </p>
                <?php endif; ?>
            </div>

            <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:6px;padding:24px;margin-top:20px;max-width:720px;">
                <h2 style="margin-top:0;"><?php esc_html_e('Want it monitored every week?', 'sitebeat'); ?></h2>
                <p>
                    <?php esc_html_e(
                        'Sitebeat re-audits your site every Monday and emails you only when something regresses. $29/mo, cancel anytime.',
                        'sitebeat'
                    ); ?>
                </p>
                <p>
                    <a class="button button-primary" href="<?php echo esc_url(SITEBEAT_BASE_URL . '/pricing?utm_source=wp_plugin'); ?>" target="_blank">
                        <?php esc_html_e('See pricing →', 'sitebeat'); ?>
                    </a>
                </p>
            </div>

            <p style="margin-top:30px;color:#666;">
                <?php esc_html_e('Plugin powered by', 'sitebeat'); ?>
                <a href="https://sitebeat.tech?utm_source=wp_plugin" target="_blank">Sitebeat</a>
            </p>
        </div>
        <?php
    }

    /**
     * Submit the site to the Sitebeat /api/audit endpoint. Returns the
     * decoded JSON or a WP_Error.
     */
    private function run_audit($site_url, $email) {
        $response = wp_remote_post(SITEBEAT_BASE_URL . '/api/audit', [
            'headers' => ['Content-Type' => 'application/json'],
            'timeout' => 15,
            'body' => wp_json_encode([
                'url' => $site_url,
                'email' => $email,
                'attribution' => [
                    'utmSource' => 'wp_plugin',
                    'utmMedium' => 'plugin',
                    'utmCampaign' => 'sitebeat_v' . SITEBEAT_VERSION,
                ],
            ]),
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200 || empty($body['auditId'])) {
            $msg = isset($body['error']) ? $body['error'] : 'Audit failed (HTTP ' . $code . ')';
            return new WP_Error('sitebeat_audit_failed', $msg);
        }

        return $body;
    }
}

new Sitebeat_Plugin();
