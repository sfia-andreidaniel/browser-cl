DROP DATABASE IF EXISTS $DB$;

CREATE DATABASE $DB$;

USE $DB$;

DELIMITER ;

CREATE TABLE `uploads` (
  `id`                   INT          UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id`           INT          UNSIGNED NOT NULL DEFAULT 0,
  `storage_address`      CHAR(21)              NOT NULL DEFAULT '',
  `storage_address_ip`   INT          UNSIGNED NOT NULL DEFAULT 0,
  `storage_address_port` SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
  `storage_path`         CHAR(255)             NOT NULL DEFAULT '',
  `storage_file`         CHAR(255)             NOT NULL DEFAULT '',
  `storage_http`         CHAR(64)              NOT NULL DEFAULT '',
  `upload_date`          INT          UNSIGNED NOT NULL DEFAULT 0,
  `upload_ip`            CHAR(15)              NOT NULL DEFAULT '0.0.0.0',
  `jobs_completed`       TINYINT      UNSIGNED NOT NULL DEFAULT 0,
  `jobs_errors`          TINYINT      UNSIGNED NOT NULL DEFAULT 0,
  `jobs_success`         TINYINT      UNSIGNED NOT NULL DEFAULT 0,
  `jobs_total`           TINYINT      UNSIGNED NOT NULL DEFAULT 0,
  `file_size`            BIGINT       UNSIGNED NOT NULL DEFAULT 0,
  `total_size`           BIGINT       UNSIGNED NOT NULL DEFAULT 0,
  `total_processing`     INT          UNSIGNED NOT NULL DEFAULT '0',
  `mime`                 CHAR(32)              NOT NULL DEFAULT 'application/octet-stream',
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `storage_address_ip` (`storage_address_ip`,`storage_address_port`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE `uploads_tasks` (
  `id`                  BIGINT        UNSIGNED NOT NULL AUTO_INCREMENT,
  `status`              ENUM ('new','started','error','success')
                                               NOT NULL DEFAULT 'new',
  `started_date`        INT           UNSIGNED NOT NULL DEFAULT 0,
  `ended_date`          INT           UNSIGNED NOT NULL DEFAULT 0,
  `upload_id`           INT           UNSIGNED NOT NULL DEFAULT 0,
  `task_type`           ENUM ('video','audio','image')  DEFAULT NULL,
  `task_preset`         CHAR(32)               NOT NULL DEFAULT '',
  `task_size`           BIGINT        UNSIGNED NOT NULL DEFAULT 0,
  `task_extension`      CHAR(16)               NOT NULL DEFAULT '',
  `task_priority`       INT           UNSIGNED NOT NULL DEFAULT 0,
  `task_started_by`     CHAR(21)               NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `status` (`status`),
  KEY `upload_id` (`upload_id`),
  KEY `task_type` (`task_type`),
  KEY `task_preset` (`task_preset`),
  KEY `task_priority` (`task_priority`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE `access` (
  `id`                  INT           UNSIGNED NOT NULL AUTO_INCREMENT,
  `token`               CHAR(32)               NOT NULL DEFAULT '',
  `account_date`        TIMESTAMP              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `description`         CHAR(255)              DEFAULT NULL,
  `notification_url`    CHAR(255)              DEFAULT NULL,
  `notification_email`  CHAR(128)              DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE `notifications` (
  `id`                  BIGINT        UNSIGNED NOT NULL AUTO_INCREMENT,
  `date`                TIMESTAMP              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `upload_id`           INT           UNSIGNED          DEFAULT NULL,
  `notification_title`  VARCHAR(512)           NOT NULL DEFAULT 'Notification',
  `notification_text`   VARCHAR(1024)          NOT NULL DEFAULT '',
  `status`              CHAR(16)               NOT NULL DEFAULT '',
  `account_id`          INT           UNSIGNED          DEFAULT NULL,
  `sent_date`           DATETIME                        DEFAULT NULL,
  `sent_error`          VARCHAR(512)                    DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

DELIMITER |

CREATE TRIGGER update_status_jobs BEFORE UPDATE ON uploads_tasks
FOR EACH ROW BEGIN
    
    CASE Old.status
        WHEN 'new' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                END; -- new - new --
                
                WHEN 'started' THEN BEGIN
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- new - started --
                
                WHEN 'error' THEN BEGIN

                    UPDATE uploads
                    SET jobs_errors    = jobs_errors + 1,
                        jobs_completed = jobs_completed + 1
                    WHERE uploads.id = New.upload_id LIMIT 1;

                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- new - error --
                
                WHEN 'success' THEN BEGIN
                    UPDATE uploads
                    SET jobs_success   = jobs_success + 1,
                        jobs_completed = jobs_completed + 1,
                        total_size     = total_size + New.task_size
                    WHERE uploads.id = New.upload_id LIMIT 1;
                    
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- new - success --
                
            END CASE;
            
        END;
        
        WHEN 'started' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                END; -- started - new --
                
                WHEN 'started' THEN BEGIN
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- started - started --
                
                WHEN 'error' THEN BEGIN
                    
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                    
                    UPDATE uploads
                    SET jobs_errors    = jobs_errors + 1,
                        jobs_completed = jobs_completed + 1,
                        total_processing = total_processing
                            + IF ( New.started_date > 0 AND New.ended_date > 0 AND New.ended_date > New.started_date, New.ended_date - New.started_date, 0 )
                    WHERE uploads.id   = New.upload_id
                    LIMIT 1;
                END; -- started - error --
                
                WHEN 'success' THEN BEGIN
                    
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                    
                    UPDATE uploads
                    SET jobs_success     = jobs_success + 1,
                        jobs_completed   = jobs_completed + 1,
                        total_size       = total_size + New.task_size,
                        total_processing = total_processing
                            + IF ( New.started_date > 0 AND New.ended_date > 0 AND New.ended_date > New.started_date, New.ended_date - New.started_date, 0 )
                    WHERE uploads.id = New.upload_id
                    LIMIT 1;
                END; -- started - success --
                
            END CASE;
            
        END;
        
        WHEN 'error' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                    
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                    
                    UPDATE uploads
                    SET jobs_errors = jobs_errors - 1,
                        jobs_completed = jobs_completed - 1
                    WHERE uploads.id = New.upload_id LIMIT 1;
                END; -- error - new --
                
                WHEN 'started' THEN BEGIN
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                    
                    UPDATE uploads
                    SET jobs_errors = jobs_errors - 1,
                        jobs_completed = jobs_completed - 1
                    WHERE uploads.id = New.upload_id
                    LIMIT 1;
                    
                END; -- error - started --
                
                WHEN 'error' THEN BEGIN
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- error - error --
                
                WHEN 'success' THEN BEGIN
                    
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                    
                    UPDATE uploads
                    SET jobs_errors  = jobs_errors - 1,
                        jobs_success = jobs_success - 1,
                        total_size   = total_size + New.task_size
                    WHERE uploads.id = New.upload_id
                    LIMIT 1;
                    
                END; -- error - success --
                
            END CASE;
            
        END;
        
        WHEN 'success' THEN BEGIN
            
            CASE New.status
                
                WHEN 'new' THEN BEGIN
                
                    SET New.started_date = 0;
                    SET New.ended_date = 0;
                
                    UPDATE uploads
                    SET jobs_success   = jobs_success - 1,
                        jobs_completed = jobs_completed - 1,
                        total_size     = total_size - Old.task_size
                    WHERE uploads.id = New.upload_id
                    LIMIT 1;
                    
                END; -- success - new --
                
                WHEN 'started' THEN BEGIN
                    
                    UPDATE uploads
                    SET jobs_success   = jobs_success - 1,
                        jobs_completed = jobs_completed - 1,
                        total_size     = total_size - Old.task_size
                    WHERE uploads.id = New.upload_id
                    LIMIT 1;
                    
                    SET New.started_date = UNIX_TIMESTAMP( NOW() );
                    SET New.ended_date = 0;
                END; -- success - started --
                
                WHEN 'error' THEN BEGIN
                    
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                    
                    UPDATE uploads
                    SET jobs_success = jobs_success - 1,
                        jobs_errors  = jobs_errors + 1,
                        total_size   = total_size - Old.task_size
                    WHERE uploads.id = New.upload_id
                    LIMIT 1;
                END; -- success - error --
                
                WHEN 'success' THEN BEGIN
                    SET New.ended_date = UNIX_TIMESTAMP( NOW() );
                END; -- success - success --
                
            END CASE;
            
        END;
        
    END CASE;
    
END|

CREATE TRIGGER uploads_notifications AFTER UPDATE ON uploads
FOR EACH ROW BEGIN
    
    IF ( New.jobs_completed = New.jobs_total ) THEN

        IF ( New.jobs_errors = 0 ) THEN
            
            INSERT DELAYED INTO notifications ( upload_id, notification_title, notification_text, status, account_id )
            VALUES ( New.id, 
                     CONCAT( "Upload #", New.id, " finished SUCCESSFULLY" ), 
                     "All jobs of the upload finished successfully", 
                     "SUCCESS",
                     New.account_id
            );
            
        END IF;
        
        IF ( New.jobs_errors > 0 AND New.jobs_errors <> New.jobs_total ) THEN
            
            INSERT DELAYED INTO notifications ( upload_id, notification_title, notification_text, status, account_id )
            VALUES ( New.id, 
                     CONCAT( "Upload #", New.id, " finished with SOME ERRORS (", New.jobs_errors, " out of ", New.jobs_total, ")" ),
                     CONCAT( New.jobs_errors, " out of ", New.jobs_total, " jobs encountered errors. You should investigate those errors, and eventually try to restart those jobs" ),
                     "PARTIAL",
                     New.account_id
            );
            
        END IF;
        
        IF ( New.jobs_errors > 0 AND New.jobs_errors = New.jobs_total ) THEN
        
            INSERT DELAYED INTO notifications ( upload_id, notification_title, notification_text, status, account_id )
            VALUES (
                New.id,
                CONCAT( "Upload #", New.id, " completed with ERROR!" ),
                "All jobs of the upload encountered errors. Please investigate.",
                "ERROR",
                New.account_id
            );
        
        END IF;
    
    END IF;
    
END|

CREATE TRIGGER uploads_no_jobs AFTER INSERT ON uploads
FOR EACH ROW BEGIN
    
    IF ( New.jobs_total = 0 ) THEN
        
        INSERT DELAYED INTO notifications ( upload_id, notification_title, notification_text, status, account_id )
        VALUES (
            New.id,
            CONCAT ( "Upload #", New.id, " finished SUCCESSFULLY" ),
            "No jobs were scheduled for this file",
            "SUCCESS",
            New.account_id
        );
        
    END IF;
    
END|

DELIMITER ;

