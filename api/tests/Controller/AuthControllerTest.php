<?php
namespace Crypter\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

use Symfony\Component\HttpFoundation\Response;

use Crypter\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

// ./api/bin/phpunit -c ./api/phpunit.xml.dist
class AuthControllerTest extends WebTestCase
{
    protected static $em;

    public static function setUpBeforeClass(): void
    {
        self::bootKernel();

        self::$em = self::$container->get(EntityManagerInterface::class);
    }

    public function setUp(): void
    {
        self::$em->getConnection()->query('TRUNCATE "user" CASCADE');
    }

    public function tearDown(): void
    {
        self::$em->getConnection()->query('TRUNCATE "user" CASCADE');
    }

    public function testRegistraion()
    {
        $email = "tester@crypter.com";
        $name = "Tester";
        $password = "password";
        $publicKey = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";
        $privateKey = "-----BEGIN PGP PRIVATE KEY BLOCK ... ";
        $revocationCertificate = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";

        $client = static::createClient();

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $response = $client->getResponse();

        $this->assertTrue($response->isSuccessful());

        $data = json_decode($response->getContent(), $assoc = true);
        $cookies = $client->getCookieJar();

        $this->assertArrayHasKey('uuid', $data);
        $this->assertArrayHasKey('email', $data);
        $this->assertArrayHasKey('name', $data);
        $this->assertArrayHasKey('hash', $data);
        $this->assertArrayHasKey('public_key', $data);
        $this->assertArrayHasKey('private_key', $data);
        $this->assertArrayHasKey('revocation_certificate', $data);

        $this->assertNotNull($cookies->get('uuid'));
        $this->assertNotNull($cookies->get('email'));
        $this->assertNotNull($cookies->get('name'));
        $this->assertNotNull($cookies->get('hash'));


        $client->request(
            $method = 'POST',
            $uri = '/api/auth/login',
            $parameters = [
                'email' => $email,
                'password' => $password
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->assertTrue($client->getResponse()->isSuccessful());
    }

    public function testTwiceRegistration()
    {
        $email = "tester@crypter.com";
        $name = "Tester";
        $password = "password";
        $publicKey = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";
        $privateKey = "-----BEGIN PGP PRIVATE KEY BLOCK ... ";
        $revocationCertificate = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";

        $client = static::createClient();

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->assertEquals(
            400,
            $client->getResponse()->getStatusCode()
        );
    }

    public function testRegistrationValidation()
    {
        $email = "";
        $name = "";
        $password = "";
        $publicKey = "";
        $privateKey = "";
        $revocationCertificate = "";

        $client = static::createClient();

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->assertEquals(
            400,
            $client->getResponse()->getStatusCode()
        );
    }

    public function testLogin()
    {
        $email = "tester@crypter.com";
        $name = "Tester";
        $password = "password";
        $publicKey = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";
        $privateKey = "-----BEGIN PGP PRIVATE KEY BLOCK ... ";
        $revocationCertificate = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";

        $client = static::createClient();

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/login',
            $parameters = [
                'email' => $email,
                'password' => $password
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->assertEquals(
            404,
            $client->getResponse()->getStatusCode()
        );


        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/login',
            $parameters = [
                'email' => $email,
                'password' => $password
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $response = $client->getResponse();

        $this->assertTrue($response->isSuccessful());

        $data = json_decode($response->getContent(), $assoc = true);
        $cookies = $client->getCookieJar();

        $this->assertArrayHasKey('uuid', $data);
        $this->assertArrayHasKey('email', $data);
        $this->assertArrayHasKey('name', $data);
        $this->assertArrayHasKey('hash', $data);
        $this->assertArrayHasKey('last_seen', $data);
        $this->assertArrayHasKey('public_key', $data);
        $this->assertArrayHasKey('private_key', $data);
        $this->assertArrayHasKey('revocation_certificate', $data);

        $this->assertNotNull($cookies->get('uuid'));
        $this->assertNotNull($cookies->get('email'));
        $this->assertNotNull($cookies->get('name'));
        $this->assertNotNull($cookies->get('hash'));

        $this->assertTrue($client->getResponse()->isSuccessful());

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/logout',
            $parameters = [],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$data['hash']}"
            ]
        );

        $this->assertTrue($client->getResponse()->isSuccessful());
    }

    public function testLoginValidation()
    {
        $email = "";
        $password = "";

        $client = static::createClient();

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/login',
            $parameters = [
                'email' => $email,
                'password' => $password
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->assertEquals(
            400,
            $client->getResponse()->getStatusCode()
        );
    }

    public function testLogout()
    {
        $email = "tester@crypter.com";
        $name = "Tester";
        $password = "password";
        $publicKey = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";
        $privateKey = "-----BEGIN PGP PRIVATE KEY BLOCK ... ";
        $revocationCertificate = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";

        $client = static::createClient();

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $response = $client->getResponse();

        $data = json_decode($response->getContent(), $assoc = true);


        $client->request(
            $method = 'POST',
            $uri = '/api/auth/logout',
            $parameters = [],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$data['hash']}"
            ]
        );

        $cookies = $client->getCookieJar();

        $this->assertNull($cookies->get('uuid'));
        $this->assertNull($cookies->get('email'));
        $this->assertNull($cookies->get('name'));
        $this->assertNull($cookies->get('hash'));

        $this->assertTrue($client->getResponse()->isSuccessful());
    }

    public function testEmailExistence()
    {
        $email = "tester@crypter.com";
        $name = "Tester";
        $password = "password";
        $publicKey = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";
        $privateKey = "-----BEGIN PGP PRIVATE KEY BLOCK ... ";
        $revocationCertificate = "-----BEGIN PGP PUBLIC KEY BLOCK ... ";

        $client = static::createClient();

        $client->request(
            $method = 'GET',
            $uri = "/api/auth/email/{$email}",
            $parameters = [],
            $files = [],
            $server = []
        );

        $this->assertEquals(
            404,
            $client->getResponse()->getStatusCode()
        );


        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'public_key' => $publicKey,
                'private_key' => $privateKey,
                'revocation_certificate' => $revocationCertificate
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $client->request(
            $method = 'GET',
            $uri = "/api/auth/email/{$email}",
            $parameters = [],
            $files = [],
            $server = []
        );

        $this->assertEquals(
            200,
            $client->getResponse()->getStatusCode()
        );
    }
}
